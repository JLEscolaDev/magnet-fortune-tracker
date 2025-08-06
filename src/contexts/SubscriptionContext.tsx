import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getActiveSubscription, ActiveSubscription } from '@/integrations/supabase/subscriptions';
import { Session, User } from '@supabase/supabase-js';

interface SubscriptionContextType {
  loading: boolean;
  isActive: boolean;
  subscription: ActiveSubscription | null;
  refetch: () => Promise<void>;
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  sessionInitialized: boolean;
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

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const activeSubscription = await getActiveSubscription(supabase);
      setSubscription(activeSubscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
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
      }
    });

    getInitialSession();

    return () => {
      listener.subscription.unsubscribe();
    };
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