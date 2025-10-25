import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * Hook to handle Stripe checkout success redirects
 * Call this in any component/page that might receive users after checkout
 */
export const useCheckoutSuccess = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      toast.success('Payment Successful! 🎉', {
        description: 'Your subscription has been activated. Welcome to Pro!',
      });
      // Remove session_id from URL without navigation
      setSearchParams((prev) => {
        prev.delete('session_id');
        return prev;
      });
    }
  }, [searchParams, setSearchParams]);
};
