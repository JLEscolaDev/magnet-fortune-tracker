import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getActiveSubscription, ActiveSubscription } from '@/integrations/supabase/subscriptions';

interface SubscriptionContextType {
  loading: boolean;
  isActive: boolean;
  subscription: ActiveSubscription | null;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);

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

  // Initial fetch on mount
  useEffect(() => {
    fetchSubscription();
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        startPeriodicRefresh();
      }
    };

    checkAndStartRefresh();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Real-time updates removed - using auth state changes for subscription updates

  const value: SubscriptionContextType = {
    loading,
    isActive: subscription !== null,
    subscription,
    refetch: fetchSubscription,
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