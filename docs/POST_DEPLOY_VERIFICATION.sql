-- Post-Deploy Verification SQL
-- Run these queries after deploying migrations to verify correctness
-- Copy/paste into Supabase SQL Editor or psql

-- ============================================================================
-- 1. VERIFY NO DUPLICATE SUBSCRIPTIONS
-- ============================================================================
-- Expected: 0 rows (each user should have at most 1 subscription)
SELECT user_id, COUNT(*) as subscription_count
FROM public.subscriptions
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ============================================================================
-- 2. VERIFY UNIQUE CONSTRAINT EXISTS
-- ============================================================================
-- Expected: 1 row with conname='subscriptions_user_id_key', contype='u'
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'public.subscriptions'::regclass 
  AND conname = 'subscriptions_user_id_key';

-- ============================================================================
-- 3. VERIFY STATUS CHECK CONSTRAINT ALLOWS 'trialing'
-- ============================================================================
-- Expected: 1 row with constraint_def containing 'trialing'
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid = 'public.subscriptions'::regclass 
  AND conname = 'subscriptions_status_check';

-- Test: This should NOT fail (if it does, constraint is blocking 'trialing')
-- Uncomment to test:
-- UPDATE public.subscriptions 
-- SET status = 'trialing' 
-- WHERE user_id = (SELECT user_id FROM public.subscriptions LIMIT 1)
--   AND status = 'active';

-- ============================================================================
-- 4. VERIFY user_features VIEW COLUMNS EXIST
-- ============================================================================
-- Expected: Rows for each column below
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_features'
  AND column_name IN (
    'user_id',
    'trial_ends_at',
    'early_bird_seen',
    'early_bird_redeemed',
    'early_bird_eligible',
    'subscription_tier',
    'subscription_status',
    'is_lifetime',
    'current_period_end',
    'is_trial_active',
    'total_fortunes',
    'has_full_access'
  )
ORDER BY column_name;

-- ============================================================================
-- 5. VERIFY has_full_access LOGIC IS CORRECT
-- ============================================================================
-- This query compares the actual has_full_access value with expected logic
-- Expected: has_full_access should match expected_access for all rows
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
  END AS expected_access,
  CASE 
    WHEN has_full_access = (CASE
      WHEN is_lifetime = true AND subscription_status = 'active' THEN true
      WHEN subscription_status IN ('active', 'trialing') THEN true
      WHEN is_trial_active = true THEN true
      ELSE false
    END) THEN '✅ CORRECT'
    ELSE '❌ MISMATCH'
  END AS verification
FROM public.user_features
WHERE subscription_status IS NOT NULL OR is_trial_active = true
ORDER BY user_id
LIMIT 20;

-- ============================================================================
-- 6. VERIFY NO LEGACY ACTIVE ROWS WITHOUT STRIPE DATA
-- ============================================================================
-- Expected: 0 rows (no non-lifetime active subscriptions without Stripe IDs)
SELECT user_id, status, tier, is_lifetime, stripe_subscription_id, stripe_customer_id, stripe_price_id
FROM public.subscriptions
WHERE is_lifetime != true
  AND status IN ('active', 'trialing')
  AND (
    stripe_subscription_id IS NULL 
    OR stripe_customer_id IS NULL 
    OR stripe_price_id IS NULL
  );

-- ============================================================================
-- 7. VERIFY TIER VALUES ARE NORMALIZED
-- ============================================================================
-- Expected: All tiers should be in ('essential','growth','pro','lifetime')
-- Should return 0 rows if all normalized
SELECT user_id, tier, status
FROM public.subscriptions
WHERE tier IS NOT NULL
  AND tier NOT IN ('essential', 'growth', 'pro', 'lifetime');

-- ============================================================================
-- 8. VERIFY early_bird_eligible LOGIC
-- ============================================================================
-- Sample check: Users with early_bird_eligible=true should have:
-- - early_bird_seen = true
-- - early_bird_redeemed = false (or NULL)
-- - is_trial_active = true
SELECT 
  user_id,
  early_bird_seen,
  early_bird_redeemed,
  is_trial_active,
  early_bird_eligible,
  CASE
    WHEN early_bird_eligible = true 
      AND (early_bird_seen = true 
        AND (early_bird_redeemed IS NULL OR early_bird_redeemed = false)
        AND is_trial_active = true) THEN '✅ CORRECT'
    WHEN early_bird_eligible = false THEN '✅ CORRECT (not eligible)'
    ELSE '❌ MISMATCH'
  END AS verification
FROM public.user_features
WHERE early_bird_seen = true OR early_bird_eligible = true
LIMIT 10;
