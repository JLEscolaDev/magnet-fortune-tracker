import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getActiveSubscription, ActiveSubscription } from '@/integrations/supabase/subscriptions';
import { Session, User } from '@supabase/supabase-js';

interface Plan {
  id: string;
  name: string;
  tier: string;
  price_id: string;
  level: number;
  billing_period: '28d' | 'annual' | 'lifetime';
  is_early_bird: boolean;
  created_at: string | null;
}

interface PlansByCycle {
  '28d': Plan[];
  annual: Plan[];
  lifetime?: Plan;
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
  userFeatures: any | null;
  isTrialActive: boolean;
  earlyBirdEligible: boolean;
  plansByCycle: PlansByCycle;
  plansLoading: boolean;
  hasActiveSub: boolean;
  allPlans: Plan[];
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [userFeatures, setUserFeatures] = useState<any>(null);
  const [plansByCycle, setPlansByCycle] = useState<PlansByCycle>({ '28d': [], annual: [] });
  const [plansLoading, setPlansLoading] = useState(true);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [earlyBirdEligible, setEarlyBirdEligible] = useState(false);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const activeSubscription = await getActiveSubscription(supabase);
      setSubscription(activeSubscription);
      
        // Also fetch user features if user is available
        if (user) {
          const { data: features, error } = await supabase
            .from('user_features_v')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (error) {
            console.error('Error fetching user features:', error);
          }
          
          setUserFeatures(features);
          setEarlyBirdEligible(!!(features as any)?.early_bird_eligible);
        }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      setPlansLoading(true);
      const { data: plans, error } = await supabase
        .from('plans')
        .select('*')
        .order('level', { ascending: true });

      if (error) throw error;

      // Group plans by billing_period  
      const plansByCycle: PlansByCycle = { '28d': [], annual: [] };
      
      plans?.forEach((plan: any) => {
        // Add tier field based on name if not present
        const planWithTier = {
          ...plan,
          tier: plan.tier || getTierFromName(plan.name)
        };
        
        if (plan.billing_period === '28d') {
          plansByCycle['28d'].push(planWithTier);
        } else if (plan.billing_period === 'annual') {
          plansByCycle.annual.push(planWithTier);
        } else if (plan.billing_period === 'lifetime') {
          plansByCycle.lifetime = planWithTier;
        }
      });

      setPlansByCycle(plansByCycle);
      setAllPlans(plans?.map((plan: any) => ({ 
        ...plan, 
        tier: plan.tier || getTierFromName(plan.name),
        billing_period: plan.billing_period as '28d' | 'annual' | 'lifetime',
        is_early_bird: plan.is_early_bird || false
      })) || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setPlansLoading(false);
    }
  };

  const getTierFromName = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('essential')) return 'essential';
    if (lowerName.includes('growth')) return 'growth';
    if (lowerName.includes('pro')) return 'pro';
    return 'unknown';
  };

  useEffect(() => {
    const getInitialSession = async () => {
      setAuthLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      setSessionInitialized(true);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchSubscription(); // refetch on login or token refresh
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

  // When user changes, (re)fetch subscription & user features
  useEffect(() => {
    if (user) {
      // ensures we have earlyBirdEligible/isTrialActive as soon as the session is ready
      fetchSubscription();
    } else {
      // clear feature flags on logout / no session
      setUserFeatures(null);
      setEarlyBirdEligible(false);
    }
  }, [user]);

  // Fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, []);

  // Manual refresh check every 5 minutes for subscription updates
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
  }, [user]);

  // Real-time updates removed - using auth state changes for subscription updates

  const value: SubscriptionContextType = {
    loading,
    isActive: subscription !== null,
    subscription,
    refetch: fetchSubscription,
    session,
    user,
    authLoading,
    sessionInitialized,
    userFeatures,
    isTrialActive: userFeatures?.is_trial_active || false,
    earlyBirdEligible,
    plansByCycle,
    plansLoading,
    hasActiveSub: userFeatures?.has_full_access || false,
    allPlans,
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