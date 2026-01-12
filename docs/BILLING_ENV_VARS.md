# Billing Environment Variables

**Single source of truth** for all billing-related environment variables used in Supabase Edge Functions.

> **Note**: These variables are set as Supabase Edge Function secrets using:
> ```bash
> supabase secrets set VARIABLE_NAME=value
> ```

---

## Stripe Configuration

### Required in Both TEST and LIVE

#### `STRIPE_SECRET_KEY`
- **Type**: String
- **Required**: ✅ Yes
- **Description**: Stripe API secret key (starts with `sk_test_` for test mode, `sk_live_` for live mode)
- **Used in**:
  - `stripe-webhook/index.ts` - Webhook signature verification and event processing
  - `create-checkout-session/index.ts` - Creating checkout sessions
  - `create-portal-session/index.ts` - Creating billing portal sessions
  - `list-pricing/index.ts` - Fetching price data from Stripe
  - `get-prices/index.ts` - Fetching price details for multiple price IDs
- **Test Mode**: Use Stripe test mode secret key (`sk_test_...`)
- **Live Mode**: Use Stripe live mode secret key (`sk_live_...`)

#### `STRIPE_WEBHOOK_SECRET`
- **Type**: String
- **Required**: ✅ Yes
- **Description**: Stripe webhook signing secret (starts with `whsec_`) from your webhook endpoint configuration
- **Used in**: `stripe-webhook/index.ts` - Webhook signature verification
- **Test Mode**: Webhook secret from test mode webhook endpoint
- **Live Mode**: Webhook secret from live mode webhook endpoint
- **Note**: Must match the webhook endpoint configured in Stripe Dashboard

---

## Price IDs (Stripe Product Prices)

> **Important**: These `PRICE_*` environment variables should match the `price_id` values stored in the `public.plans` table in Supabase.
> 
> The `plans` table is the source of truth for plan configuration, but these env vars are used for:
> - Mapping Stripe webhook events to subscription tiers
> - Legacy plan name mapping in `create-checkout-session`

### 28-Day Billing Cycle

#### `PRICE_ESSENTIAL_28D`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (used for tier mapping in webhook)
- **Description**: Essential tier, 28-day recurring subscription price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`

#### `PRICE_GROWTH_28D`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (used for tier mapping in webhook)
- **Description**: Growth tier, 28-day recurring subscription price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`

#### `PRICE_PRO_28D`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (used for tier mapping in webhook)
- **Description**: Pro tier, 28-day recurring subscription price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`

### Annual Billing Cycle

#### `PRICE_ESSENTIAL_ANNUAL`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (used for tier mapping in webhook)
- **Description**: Essential tier, annual recurring subscription price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`

#### `PRICE_GROWTH_ANNUAL`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (used for tier mapping in webhook)
- **Description**: Growth tier, annual recurring subscription price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`

#### `PRICE_PRO_ANNUAL`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (used for tier mapping in webhook)
- **Description**: Pro tier, annual recurring subscription price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`

### Early Bird Annual (Founders Pricing)

#### `PRICE_ESSENTIAL_ANNUAL_EB`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (only if offering early bird pricing)
- **Description**: Essential tier, annual recurring subscription with early bird discount price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`
- **Note**: This should correspond to a separate Stripe Price object with discounted pricing

#### `PRICE_GROWTH_ANNUAL_EB`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (only if offering early bird pricing)
- **Description**: Growth tier, annual recurring subscription with early bird discount price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`
- **Note**: This should correspond to a separate Stripe Price object with discounted pricing

#### `PRICE_PRO_ANNUAL_EB`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (only if offering early bird pricing)
- **Description**: Pro tier, annual recurring subscription with early bird discount price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`
- **Note**: This should correspond to a separate Stripe Price object with discounted pricing

### Lifetime (One-Time Payment)

#### `PRICE_LIFETIME_ONEOFF`
- **Type**: String (Stripe Price ID, format: `price_...`)
- **Required**: ⚠️ Optional (only if offering lifetime plan)
- **Description**: Lifetime tier, one-time payment price ID
- **Used in**: `stripe-webhook/index.ts`, `create-checkout-session/index.ts`
- **Example**: `price_1234567890abcdef`
- **Note**: This must be a Stripe Price with `type: "one_time"` (not recurring)

---

## Promotion Codes (Optional)

### `PROMO_EARLY_BIRD_ESSENTIAL_ANNUAL_CODE`
- **Type**: String (Stripe Promotion Code ID)
- **Required**: ❌ No (optional, alternative to separate early bird price IDs)
- **Description**: Stripe promotion code for Essential tier annual early bird discount
- **Used in**: `create-checkout-session/index.ts` - Applied when `earlyBird=true` and `tier="essential"`
- **Test Mode**: Use test mode promotion code
- **Live Mode**: Use live mode promotion code
- **Note**: Alternative to using separate `PRICE_*_ANNUAL_EB` price IDs. If both are set, price IDs take precedence.

### `PROMO_EARLY_BIRD_GROWTH_ANNUAL_CODE`
- **Type**: String (Stripe Promotion Code ID)
- **Required**: ❌ No (optional, alternative to separate early bird price IDs)
- **Description**: Stripe promotion code for Growth tier annual early bird discount
- **Used in**: `create-checkout-session/index.ts` - Applied when `earlyBird=true` and `tier="growth"`
- **Test Mode**: Use test mode promotion code
- **Live Mode**: Use live mode promotion code
- **Note**: Alternative to using separate `PRICE_*_ANNUAL_EB` price IDs. If both are set, price IDs take precedence.

---

## Environment-Specific Requirements

### TEST Environment (Development/Staging)

**Required:**
- ✅ `STRIPE_SECRET_KEY` (test mode key: `sk_test_...`)
- ✅ `STRIPE_WEBHOOK_SECRET` (test webhook endpoint secret: `whsec_...`)

**Recommended:**
- ⚠️ All `PRICE_*` variables matching test mode Stripe prices
- ❌ `PROMO_*` codes (optional)

**Note**: In test mode, you can use Stripe test mode products/prices. Ensure the price IDs in `public.plans` table match your test Stripe account.

### LIVE Environment (Production)

**Required:**
- ✅ `STRIPE_SECRET_KEY` (live mode key: `sk_live_...`)
- ✅ `STRIPE_WEBHOOK_SECRET` (live webhook endpoint secret: `whsec_...`)

**Required for Full Functionality:**
- ⚠️ All `PRICE_*` variables matching live mode Stripe prices (critical for webhook tier mapping)
- ❌ `PROMO_*` codes (optional, if using promotion codes instead of separate price IDs)

**Note**: In live mode, price IDs must match your live Stripe account. Ensure the `public.plans` table is populated with correct live price IDs.

---

## Usage by Function

### `stripe-webhook/index.ts`
- `STRIPE_SECRET_KEY` - Required
- `STRIPE_WEBHOOK_SECRET` - Required
- All `PRICE_*` variables - Used for `tierFromPriceId()` mapping

### `create-checkout-session/index.ts`
- `STRIPE_SECRET_KEY` - Required
- All `PRICE_*` variables - Used for legacy plan name mapping
- `PROMO_EARLY_BIRD_ESSENTIAL_ANNUAL_CODE` - Optional
- `PROMO_EARLY_BIRD_GROWTH_ANNUAL_CODE` - Optional

### `create-portal-session/index.ts`
- `STRIPE_SECRET_KEY` - Required

### `list-pricing/index.ts`
- `STRIPE_SECRET_KEY` - Required
- **Note**: This function reads prices from `public.plans` table, not from env vars

### `get-prices/index.ts`
- `STRIPE_SECRET_KEY` - Required
- **Note**: This function accepts price IDs as input, not from env vars

---

## Verification Checklist

After setting environment variables, verify:

1. ✅ `STRIPE_SECRET_KEY` is set and matches your Stripe account mode (test/live)
2. ✅ `STRIPE_WEBHOOK_SECRET` matches your webhook endpoint in Stripe Dashboard
3. ✅ All `PRICE_*` variables match the `price_id` values in your `public.plans` table
4. ✅ Webhook events are successfully processing (check logs in `stripe-webhook`)
5. ✅ Checkout sessions are created successfully (test with `create-checkout-session`)
6. ✅ Billing portal sessions work (test with `create-portal-session`)

---

## Related Documentation

- [Billing System Documentation](./billing.md)
- [Stripe Billing Validation Checklist](./STRIPE_BILLING_VALIDATION_CHECKLIST.md)
- [Post-Deploy Verification SQL](./POST_DEPLOY_VERIFICATION.sql)
