import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSubscription } from '@/contexts/SubscriptionContext';

/**
 * Hook to handle Stripe checkout success redirects.
 * It triggers a subscription refetch (with retries) because the webhook/database update
 * can lag behind the browser redirect by a few seconds.
 */
export const useCheckoutSuccess = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refetch } = useSubscription();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) return;

    toast.success('Payment successful! 🎉', {
      description: 'Updating your plan…',
    });

    // Remove session_id from URL without navigation
    setSearchParams((prev) => {
      prev.delete('session_id');
      return prev;
    });

    let cancelled = false;

    const run = async () => {
      // Retry a few times to survive webhook/DB propagation delays
      const delaysMs = [250, 500, 1000, 1500, 2000, 2500];

      for (const delay of delaysMs) {
        if (cancelled) return;

        await refetch();

        if (cancelled) return;
        await new Promise((r) => setTimeout(r, delay));
      }

      // Final fetch (no delay after)
      if (!cancelled) {
        await refetch();
      }

      if (!cancelled) {
        toast.success('Plan updated ✅', {
          description: 'Your account is now active.',
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, refetch]);
};