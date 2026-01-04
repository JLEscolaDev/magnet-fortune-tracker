/**
 * @deprecated This hook is now a no-op. Checkout success handling has been
 * consolidated into SubscriptionContext to prevent race conditions from
 * multiple hook instances running simultaneously.
 *
 * The SubscriptionContext now:
 * 1. Detects session_id in URL after Stripe redirect
 * 2. Shows toast notifications for payment success
 * 3. Polls for subscription updates with early exit when found
 * 4. Subscribes to Supabase Realtime for instant updates
 * 5. Removes session_id from URL after processing
 *
 * This file is kept for backward compatibility during migration.
 * Safe to remove all useCheckoutSuccess() calls from components.
 */
export const useCheckoutSuccess = () => {
  // No-op: all logic moved to SubscriptionContext
};
