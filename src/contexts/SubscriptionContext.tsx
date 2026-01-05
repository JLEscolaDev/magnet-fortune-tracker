import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getActiveSubscription, ActiveSubscription } from '@/integrations/supabase/subscriptions';
import { Session, User, RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  tier: string;
  price_id: string;
  level: number;
  billing_period: '28d' | 'annual' | 'lifetime';
  is_early_bird: boolean;
  visibility: 'visible' | 'hidden' | 'teaser';
  created_at: string | null;
}

interface PlansByCycle {
  '28d': Plan[];
  annual: Plan[];
  lifetime?: Plan;
}

interface UserFeatures {
  early_bird_eligible?: boolean;
  has_full_access?: boolean;
  is_trial_active?: boolean;
  [key: string]: unknown;
}

interface SubscriptionContextType {
  loading: boolean;
  isActive: boolean;
  subscription: ActiveSubscription | null;
  refetch: () => Promise<void>;
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  sessionInitialized: boolean;
  userFeatures: UserFeatures | null;
  isTrialActive: boolean;
  earlyBirdEligible: boolean;
  plansByCycle: PlansByCycle;
  plansLoading: boolean;
  hasActiveSub: boolean;
  allPlans: Plan[];
  isHighTier: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [userFeatures, setUserFeatures] = useState<UserFeatures | null>(null);
  const [plansByCycle, setPlansByCycle] = useState<PlansByCycle>({ '28d': [], annual: [] });
  const [plansLoading, setPlansLoading] = useState(true);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [earlyBirdEligible, setEarlyBirdEligible] = useState(false);

  // Ref to track if we've already handled a checkout session
  const handledSessionIdRef = useRef<string | null>(null);
  // Ref to track the realtime channel
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  // Ref to hold latest fetchSubscription for use in event callbacks
  const fetchSubscriptionRef = useRef<() => Promise<ActiveSubscription | null>>(() => Promise.resolve(null));

  const fetchSubscription = useCallback(async (): Promise<ActiveSubscription | null> => {
    try {
      setLoading(true);
      const activeSubscription = await getActiveSubscription(supabase);
      setSubscription(activeSubscription);
      
      // Also fetch user features if user is available
      if (user) {
        const { data: features, error } = await supabase
          .from('user_features')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching user features:', error);
        }
        
        setUserFeatures(features as UserFeatures);
        setEarlyBirdEligible(!!(features as UserFeatures)?.early_bird_eligible);
      }
      
      return activeSubscription;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Keep ref in sync for use in event callbacks
  useEffect(() => {
    fetchSubscriptionRef.current = fetchSubscription;
  }, [fetchSubscription]);

  const getTierFromName = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('essential')) return 'essential';
    if (lowerName.includes('growth')) return 'growth';
    if (lowerName.includes('pro')) return 'pro';
    return 'unknown';
  };

  const fetchPlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      const { data: plans, error } = await supabase
        .from('plans')
        .select('*')
        .order('level', { ascending: true });

      if (error) throw error;

      // Group plans by billing_period  
      const grouped: PlansByCycle = { '28d': [], annual: [] };
      
      plans?.forEach((plan: Record<string, unknown>) => {
        // Add tier field based on name if not present
        const planWithTier = {
          ...plan,
          tier: (plan.tier as string) || getTierFromName(plan.name as string)
        };
        
        if (plan.billing_period === '28d') {
          grouped['28d'].push(planWithTier as Plan);
        } else if (plan.billing_period === 'annual') {
          grouped.annual.push(planWithTier as Plan);
        } else if (plan.billing_period === 'lifetime') {
          grouped.lifetime = planWithTier as Plan;
        }
      });

      setPlansByCycle(grouped);
      setAllPlans(plans?.map((plan: Record<string, unknown>) => ({ 
        ...plan, 
        tier: (plan.tier as string) || getTierFromName(plan.name as string),
        billing_period: plan.billing_period as '28d' | 'annual' | 'lifetime',
        is_early_bird: (plan.is_early_bird as boolean) || false
      } as Plan)) || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setPlansLoading(false);
    }
  }, []);


  // Handle checkout success with smart polling
  const handleCheckoutSuccess = useCallback(async (sessionId: string) => {
    // Avoid duplicate handling
    if (handledSessionIdRef.current === sessionId) {
      return;
    }
    handledSessionIdRef.current = sessionId;

    console.log('[SUBSCRIPTION] Handling checkout success:', sessionId);

    toast.success('Payment successful! 🎉', {
      description: 'Updating your plan…',
    });

    // Remove session_id from URL without navigation (create new URLSearchParams to avoid mutation)
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('session_id');
      return newParams;
    }, { replace: true });

    // Smart polling: retry until subscription is found or max attempts reached
    const maxAttempts = 10;
    const delaysMs = [300, 500, 800, 1200, 1500, 2000, 2500, 3000, 3500, 4000];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.log(`[SUBSCRIPTION] Polling attempt ${attempt + 1}/${maxAttempts}`);
      
      const result = await fetchSubscription();
      
      if (result) {
        console.log('[SUBSCRIPTION] Subscription found:', result);
        toast.success('Plan updated ✅', {
          description: result.is_lifetime 
            ? 'Your lifetime access is now active!' 
            : 'Your subscription is now active.',
        });
        return;
      }

      // Wait before next attempt
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delaysMs[attempt] || 2000));
      }
    }

    // Final attempt completed without finding subscription
    console.warn('[SUBSCRIPTION] Could not confirm subscription after polling');
    toast.info('Plan update in progress', {
      description: 'Your plan should activate shortly. Try refreshing if needed.',
    });
  }, [fetchSubscription, setSearchParams]);

  // Check for session_id in URL on mount and when searchParams change
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId && sessionId !== handledSessionIdRef.current && user) {
      handleCheckoutSuccess(sessionId);
    }
  }, [searchParams, user, handleCheckoutSuccess]);

  // Auth state management - uses ref to access latest fetchSubscription in callback
  useEffect(() => {
    const getInitialSession = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SubscriptionContext.tsx:getInitialSession',message:'Getting initial session',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setAuthLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SubscriptionContext.tsx:getInitialSession:result',message:'Initial session result',data:{hasSession:!!session,hasUser:!!session?.user,userId:session?.user?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      setSessionInitialized(true);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SubscriptionContext.tsx:onAuthStateChange',message:'Auth state change event',data:{event,hasSession:!!newSession,hasUser:!!newSession?.user,userId:newSession?.user?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SubscriptionContext.tsx:onAuthStateChange:SIGNED_IN',message:'SIGNED_IN event detected',data:{event,userId:newSession?.user?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Use ref to get latest fetchSubscription to avoid stale closure
        fetchSubscriptionRef.current();
      }

      if (event === 'SIGNED_OUT') {
        setSubscription(null); // clear on logout
        setUserFeatures(null);
      }
    });

    getInitialSession();

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // When user changes, (re)fetch subscription & user features + setup realtime
  useEffect(() => {
    if (user) {
      // ensures we have earlyBirdEligible/isTrialActive as soon as the session is ready
      fetchSubscription();

      // Setup Realtime subscription for instant updates
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }

      const channel = supabase
        .channel(`subscriptions:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('[SUBSCRIPTION] Realtime update received:', payload);
            // Use ref to get latest fetchSubscription to avoid stale closure
            fetchSubscriptionRef.current();
          }
        )
        .subscribe((status) => {
          console.log('[SUBSCRIPTION] Realtime subscription status:', status);
        });

      realtimeChannelRef.current = channel;
    } else {
      // clear feature flags on logout / no session
      setUserFeatures(null);
      setEarlyBirdEligible(false);

      // Cleanup realtime channel
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    }

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [user, fetchSubscription]);

  // Fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Manual refresh check every 5 minutes for subscription updates (backup mechanism)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const startPeriodicRefresh = () => {
      intervalId = setInterval(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log('[SUBSCRIPTION] Periodic refresh check');
          await fetchSubscription();
        }
      }, 5 * 60 * 1000); // 5 minutes
    };

    // Start periodic refresh only if we have a session
    const checkAndStartRefresh = async () => {
      if (user) {
        startPeriodicRefresh();
      }
    };

    checkAndStartRefresh();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [user, fetchSubscription]);

  const isActive = useMemo(() => {
    const sub = subscription;
    if (!sub) return false;
    if (sub.is_lifetime) return true;
    if (!sub.current_period_end) return false;

    const endTs = typeof sub.current_period_end === 'string'
      ? Date.parse(sub.current_period_end)
      : new Date(sub.current_period_end).getTime();

    return Number.isFinite(endTs) && endTs > Date.now();
  }, [subscription]);

  const isHighTier = useMemo(() => {
    // Photo attachments require Pro subscription, Lifetime, or active trial
    return isActive || subscription?.is_lifetime || (userFeatures?.has_full_access ?? false) || (userFeatures?.is_trial_active ?? false);
  }, [isActive, subscription, userFeatures]);

  const refetchWrapper = useCallback(async () => {
    await fetchSubscription();
  }, [fetchSubscription]);

  const value: SubscriptionContextType = {
    loading,
    isActive,
    subscription,
    refetch: refetchWrapper,
    session,
    user,
    authLoading,
    sessionInitialized,
    userFeatures,
    isTrialActive: userFeatures?.is_trial_active || false,
    earlyBirdEligible,
    plansByCycle,
    plansLoading,
    hasActiveSub: isActive || (userFeatures?.has_full_access ?? false),
    allPlans,
    isHighTier,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
