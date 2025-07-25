import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getActiveSubscription, type ActiveSubscription } from '@/integrations/supabase/subscriptions';

interface UseSubscriptionReturn {
  subscription: ActiveSubscription | null;
  isActive: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useSubscription = (): UseSubscriptionReturn => {
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const activeSubscription = await getActiveSubscription(supabase);
      setSubscription(activeSubscription);
    } catch (error) {
      console.error('Error in fetchSubscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();

    // Listen for auth state changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          fetchSubscription();
        } else if (event === 'SIGNED_OUT') {
          setSubscription(null);
          setLoading(false);
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  const isActive = subscription?.status === 'active' && 
    new Date(subscription.current_period_end) > new Date();

  return {
    subscription,
    isActive,
    loading,
    refetch: fetchSubscription,
  };
};