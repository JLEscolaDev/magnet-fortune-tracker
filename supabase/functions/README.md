# Stripe Billing Edge Functions

## Setup

1. Configure secrets in Supabase dashboard:
   - `STRIPE_SECRET_KEY` - Your Stripe secret key
   - `STRIPE_WEBHOOK_SECRET` - Webhook endpoint secret from Stripe

2. Update your environment variables:
   ```bash
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   VITE_STRIPE_PRICE_PRO_MONTHLY=price_...
   VITE_STRIPE_PRICE_PRO_YEARLY=price_...
   ```

## Testing

1. Start Stripe CLI webhook forwarding:
   ```bash
   stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
   ```

2. Test checkout flow:
   - Click "Upgrade to Pro" in the app
   - Use Stripe test card: `4242 4242 4242 4242`
   - Complete checkout and verify:
     - Row exists in `public.subscriptions`
     - `active_subscription` view returns data
     - Paywall disappears without reload

3. Test portal:
   - Click "Manage Billing" after subscribing
   - Verify Stripe Customer Portal opens

## Edge Functions

- `create-checkout-session` - Creates Stripe checkout sessions for subscriptions
- `create-portal-session` - Creates billing portal sessions for subscription management  
- `stripe-webhook` - Handles Stripe webhook events to sync subscription status

## Database

The functions automatically sync subscription data to:
- `public.subscriptions` table
- `active_subscription` view (for current active subscriptions)