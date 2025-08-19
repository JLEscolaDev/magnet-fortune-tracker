# Billing System Documentation

## Overview

The billing system integrates Supabase with Stripe to provide dynamic pricing based on real-time data from both services.

## How Prices Are Loaded

### 1. Plans Source of Truth
- Plans are stored in Supabase table `public.plans`
- Each plan has: `id`, `name`, `price_id`, `level`, `billing_period`, `is_early_bird`
- Plans are fetched via `SubscriptionContext` and grouped by billing period

### 2. Price Data from Stripe
- The `get-prices` edge function fetches real-time pricing from Stripe
- Input: Array of `price_ids`
- Output: Array of price objects with `unit_amount`, `currency`, `type`, `interval`, etc.
- Frontend calls this function to get current pricing for all plans

### 3. Data Flow
```
Supabase plans → price_ids → get-prices edge function → Stripe API → formatted prices → UI
```

## Early Bird Replacement Logic

### Eligibility
- User must have `is_trial_active = true` AND `early_bird_redeemed = false`
- Checked via `SubscriptionContext.earlyBirdEligible`

### Replacement Behavior
- On Annual tab: If eligible, normal annual plans are replaced with early bird variants
- Early bird plans have `is_early_bird = true` and typically lower prices
- If no early bird variant exists for a tier, shows the normal plan
- 28-day tab always shows normal plans (no early bird replacement)

### Visual Indicators
- Early bird plans show "Founders Price" badge
- "Limited-time offer" text appears under the badge

## Testing Different Plan Types

### Monthly (28-day) Tab
```javascript
// Shows plans with billing_period = '28d'
// No early bird replacement
// Format: "€X.XX every 28 days"
```

### Annual Tab
```javascript
// Shows plans with billing_period = 'annual'
// Early bird replacement if eligible
// Format: "€X.XX / year"
```

### Lifetime
```javascript
// Shows plan with billing_period = 'lifetime'
// Appears at bottom of both tabs
// Format: "€X.XX one-time"
```

## Edge Functions

### get-prices
- **Purpose**: Fetch real-time price data from Stripe
- **Input**: `{ price_ids: string[] }`
- **Output**: Array of price objects
- **Auth**: Not required (public endpoint)

### create-checkout-session
- **Purpose**: Create Stripe checkout session
- **Input**: `{ priceId, returnUrl, earlyBird?, tier? }`
- **Output**: `{ url }` for redirect
- **Auth**: Required

### create-portal-session
- **Purpose**: Create Stripe customer portal session
- **Input**: `{ returnUrl }`
- **Output**: `{ url }` for redirect
- **Auth**: Required

## Error Handling

- Network errors show retry button
- Invalid price_ids are filtered out silently
- Loading states shown while fetching data
- Toast notifications for checkout errors

## Development Features

- Debug panel shows plan JSON in development mode
- Console logging for troubleshooting
- Graceful fallbacks for missing data

## Security Considerations

- Price data fetched server-side via edge functions
- No sensitive Stripe keys exposed to frontend
- User authentication required for checkout operations
- RLS policies protect user-specific data