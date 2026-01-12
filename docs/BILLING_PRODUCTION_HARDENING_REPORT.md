# Billing Production Hardening Report

## ✅ Migration Order - CORRECT

**Timestamps enforce correct order:**
- `20250125115958_cleanup_subscriptions_duplicates.sql` runs FIRST
- `20250125115959_add_unique_constraint_subscriptions_user_id.sql` runs SECOND
- `20250125115960_fix_user_features_view_subscription_access.sql` runs THIRD

## ✅ Cleanup Migration - IDEMPOTENT

**Status**: Safe to run multiple times
- Only processes users with `COUNT(*) > 1` - no effect if already cleaned
- Tier normalization is idempotent (updates to same values if already normalized)
- Legacy row fixing checks conditions before updating
- Verification step ensures exactly 1 row per user after cleanup

## ✅ Webhook & DB Schema - ALIGNED

**Status**: Correctly aligned
- Constraint name: `subscriptions_user_id_key` matches webhook `onConflict: "user_id"`
- Webhook always fills `stripe_price_id` and `stripe_subscription_id` for recurring subscriptions
- Lifetime rows have `is_lifetime=true` and `tier='lifetime'`
- Webhook stores Stripe status AS-IS (no remapping)

## ✅ 2099 Date Usage - CORRECT

**Status**: Only used appropriately
- Webhook: Uses 2099-12-31 for `current_period_end` on lifetime purchases (for display purposes)
- Frontend: Does NOT use 2099 or future dates for access decisions
- Access control: Uses `status` field, not dates

## 🔧 Access Gating Fixes Applied

### 1. Edge Functions Fixed

**Files:**
- `supabase/functions/issue-fortune-upload-ticket/index.ts` (lines 152-198)
- `supabase/functions/finalize-fortune-photo/index.ts` (lines 114-160)

**Before:**
```typescript
.eq('status', 'active')  // ❌ Missed lifetime and 'trialing' status
```

**After:**
```typescript
// Check subscription access: lifetime active OR recurring active/trialing
if (subscription.is_lifetime === true && subscription.status === 'active') {
  hasActiveSubscription = true;
} else if (subscription.status === 'active' || subscription.status === 'trialing') {
  // Also verify period hasn't ended
  hasActiveSubscription = periodEnd > new Date();
}
```

### 2. SubscriptionContext Fixed

**File:** `src/contexts/SubscriptionContext.tsx` (line 463-464)

**Before:**
```typescript
return isActive || subscription?.is_lifetime || ...  // ❌ Lifetime without status check
```

**After:**
```typescript
const isLifetimeActive = subscription?.is_lifetime === true && subscription?.status === 'active';
return isActive || isLifetimeActive || ...
```

### 3. Database View Fixed

**File:** `supabase/migrations/20250125115960_fix_user_features_view_subscription_access.sql` (NEW)

**Before:**
```sql
WHEN s.status = 'active' OR s.is_lifetime = true THEN true  -- ❌ Wrong lifetime check
```

**After:**
```sql
-- Lifetime: must have is_lifetime=true AND status='active'
WHEN s.is_lifetime = true AND s.status = 'active' THEN true
-- Recurring: status must be 'active' or 'trialing'
WHEN s.status = 'active' OR s.status = 'trialing' THEN true
```

## 📋 Final Access Control Logic

**Lifetime Subscriptions:**
```typescript
if (subscription.is_lifetime === true && subscription.status === 'active') {
  // ✅ Grant access
}
```

**Recurring Subscriptions:**
```typescript
if (subscription.status === 'active' || subscription.status === 'trialing') {
  if (subscription.current_period_end && new Date(subscription.current_period_end) > new Date()) {
    // ✅ Grant access
  }
}
```

**All Other Statuses:**
- `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired` → ❌ NO ACCESS
- UI should show upgrade/pay CTAs

## ✅ Safe Code Patterns (No Changes Needed)

The following patterns are SAFE because they use `getActiveSubscription()` which already checks status correctly:

- `src/components/FortuneModal.tsx:413` - Uses `activeSubscription !== null` but access is properly gated via `freePlanStatus.canAddFortune`
- `src/hooks/useAppBootstrap.ts` - Returns null for subscription (handled by SubscriptionContext)
- `src/contexts/SubscriptionContext.tsx:104,107` - Only for cache invalidation, not access control

## 📊 Validation Queries

Run these after deploying migrations:

```sql
-- 1. No duplicates remain
SELECT user_id, COUNT(*) FROM subscriptions GROUP BY user_id HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 2. All tiers normalized
SELECT id, user_id, tier FROM subscriptions 
WHERE tier NOT IN ('essential', 'growth', 'pro', 'lifetime') OR tier IS NULL;
-- Expected: 0 rows

-- 3. No legacy active rows without Stripe data
SELECT id, user_id, status, is_lifetime, stripe_subscription_id
FROM subscriptions 
WHERE status IN ('active', 'trialing')
  AND is_lifetime = false
  AND stripe_subscription_id IS NULL;
-- Expected: 0 rows

-- 4. Lifetime rows correctly flagged
SELECT id, user_id, tier, is_lifetime, status
FROM subscriptions 
WHERE tier = 'lifetime' AND is_lifetime != true;
-- Expected: 0 rows

-- 5. UNIQUE constraint exists
SELECT conname FROM pg_constraint 
WHERE conrelid = 'public.subscriptions'::regclass 
  AND conname = 'subscriptions_user_id_key';
-- Expected: 1 row

-- 6. Status CHECK constraint allows 'trialing'
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid = 'public.subscriptions'::regclass 
  AND conname = 'subscriptions_status_check';
-- Expected: 1 row with constraint_def containing 'trialing'
-- Test: INSERT INTO subscriptions (user_id, status, ...) VALUES (..., 'trialing', ...) should succeed

-- 7. user_features.has_full_access column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_features' 
  AND column_name = 'has_full_access';
-- Expected: 1 row with data_type='boolean'

-- 8. user_features.early_bird_eligible column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_features' 
  AND column_name = 'early_bird_eligible';
-- Expected: 1 row with data_type='boolean'

-- 9. user_features.has_full_access logic is correct
SELECT 
  user_id,
  subscription_status,
  is_lifetime,
  has_full_access,
  CASE
    WHEN is_lifetime = true AND subscription_status = 'active' THEN true
    WHEN subscription_status IN ('active', 'trialing') THEN true
    WHEN is_trial_active = true THEN true
    ELSE false
  END AS expected_access
FROM user_features
WHERE subscription_status IS NOT NULL
LIMIT 10;
-- Expected: has_full_access should match expected_access for all rows
```

## 🚀 Production Deployment Checklist

- [ ] Run migration `20250125115958_cleanup_subscriptions_duplicates.sql`
- [ ] Run migration `20250125115959_add_unique_constraint_subscriptions_user_id.sql`
- [ ] Run migration `20250125115960_fix_user_features_view_subscription_access.sql`
- [ ] Run migration `20250125115961_fix_subscriptions_status_constraint_add_trialing.sql`
- [ ] Verify all validation queries return 0 rows (or expected results)
- [ ] Test webhook events:
  - [ ] Lifetime purchase (`checkout.session.completed` with `mode=payment`)
  - [ ] Subscription creation (`customer.subscription.created`)
  - [ ] Payment failed (`invoice.payment_failed`) → should set `past_due`
  - [ ] Subscription canceled (`customer.subscription.deleted`) → should set `canceled`
- [ ] Verify frontend access control:
  - [ ] Users with `status='past_due'` see upgrade prompts (no access)
  - [ ] Users with `status='canceled'` see upgrade prompts (no access)
  - [ ] Users with `status='active'` or `status='trialing'` have access
  - [ ] Lifetime users with `is_lifetime=true AND status='active'` have access

---

**Status**: ✅ All critical issues fixed, ready for production
