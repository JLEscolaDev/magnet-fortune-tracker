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

  // Listen for auth state changes and refetch subscription
  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // User signed in or token refreshed, fetch subscription
          await fetchSubscription();
        } else if (event === 'SIGNED_OUT') {
          // User signed out, clear subscription
          setSubscription(null);
          setLoading(false);
        }
      }
    );

    return () => authSubscription.unsubscribe();
  }, []);

  // Listen for real-time subscription updates
  useEffect(() => {
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions'
        },
        async (payload) => {
          console.log('Subscription changed:', payload);
          // Refetch subscription data when table changes
          await fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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