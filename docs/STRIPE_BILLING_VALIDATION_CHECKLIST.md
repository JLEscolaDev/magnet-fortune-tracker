# Stripe Billing Entitlement Validation Checklist

## Production Validation Steps

Use this checklist to validate that the Stripe billing entitlement fixes are working correctly in production.

**IMPORTANT**: Migrations must run in the correct order:
1. `20250125115958_cleanup_subscriptions_duplicates.sql` (runs FIRST - cleans duplicates before adding constraint)
2. `20250125115959_add_unique_constraint_subscriptions_user_id.sql` (runs SECOND - adds constraint after cleanup)

### Pre-Deployment Checks

- [ ] Run migration `20250125115958_cleanup_subscriptions_duplicates.sql` FIRST - Verify duplicates removed and tiers normalized
- [ ] Run migration `20250125115959_add_unique_constraint_subscriptions_user_id.sql` SECOND - Verify UNIQUE constraint exists
- [ ] Run migration `20250125115960_fix_user_features_view_subscription_access.sql` THIRD - Verify view has correct has_full_access and early_bird_eligible
- [ ] Run migration `20250125115961_fix_subscriptions_status_constraint_add_trialing.sql` FOURTH - Verify status constraint allows 'trialing'
- [ ] **CRITICAL**: Migrations must run in order (cleanup before constraint, view fix, then status constraint)
- [ ] Verify webhook function has correct environment variables:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - All `PRICE_*` environment variables

### Database Validation

#### Validation Query 1: No Duplicates
```sql
SELECT user_id, COUNT(*) as row_count 
FROM subscriptions 
GROUP BY user_id 
HAVING COUNT(*) > 1;
```
- **Expected**: No results (each user should have exactly one row or none)
- **Action if fails**: Re-run cleanup migration

#### Validation Query 2: All Tiers Normalized
```sql
SELECT id, user_id, tier 
FROM subscriptions 
WHERE tier NOT IN ('essential', 'growth', 'pro', 'lifetime') 
   OR tier IS NULL;
```
- **Expected**: No results (all tiers should be normalized)
- **Action if fails**: Re-run cleanup migration

#### Validation Query 3: No Legacy Active Rows
```sql
SELECT id, user_id, status, is_lifetime, stripe_subscription_id, stripe_customer_id, stripe_price_id
FROM subscriptions 
WHERE status IN ('active', 'trialing')
  AND is_lifetime = false
  AND stripe_subscription_id IS NULL
  AND stripe_customer_id IS NULL
  AND stripe_price_id IS NULL;
```
- **Expected**: No results (non-lifetime active subscriptions must have Stripe data)
- **Action if fails**: Legacy test rows should have been marked as 'canceled' by cleanup

#### Validation Query 4: Recurring Subscriptions Have Stripe Data
```sql
SELECT id, user_id, status, tier, stripe_subscription_id, stripe_price_id
FROM subscriptions 
WHERE is_lifetime = false
  AND status IN ('active', 'trialing', 'past_due')
  AND (stripe_subscription_id IS NULL OR stripe_price_id IS NULL);
```
- **Expected**: No results (active recurring subscriptions must have stripe_subscription_id and stripe_price_id)
- **Action if fails**: Check webhook logs for failed upserts

#### Validation Query 5: Lifetime Subscriptions Correctly Flagged
```sql
SELECT id, user_id, tier, is_lifetime, status
FROM subscriptions 
WHERE tier = 'lifetime' AND is_lifetime != true;
```
- **Expected**: No results (all 'lifetime' tier rows must have is_lifetime=true)
- **Action if fails**: Update rows manually: `UPDATE subscriptions SET is_lifetime=true WHERE tier='lifetime'`

#### Validation Query 6: UNIQUE Constraint Exists
```sql
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'public.subscriptions'::regclass 
  AND conname = 'subscriptions_user_id_key';
```
- **Expected**: One row with conname='subscriptions_user_id_key', contype='u' (unique)
- **Action if fails**: Re-run constraint migration

#### Validation Query 7: Status CHECK Constraint Allows 'trialing'
```sql
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid = 'public.subscriptions'::regclass 
  AND conname = 'subscriptions_status_check';
```
- **Expected**: One row with constraint_def containing 'trialing'
- **Test**: Try inserting/updating with status='trialing' - should succeed
- **Action if fails**: Re-run status constraint migration

#### Validation Query 8: user_features.has_full_access Column Exists
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_features' 
  AND column_name = 'has_full_access';
```
- **Expected**: One row with column_name='has_full_access', data_type='boolean'
- **Action if fails**: Re-run user_features view migration

#### Validation Query 9: user_features.has_full_access Logic Correct
```sql
-- Test with a user who has active subscription
SELECT 
  user_id,
  subscription_status,
  is_lifetime,
  has_full_access,
  CASE
    WHEN is_lifetime = true AND subscription_status = 'active' THEN true
    WHEN subscription_status IN ('active', 'trialing') THEN true
    ELSE false
  END AS expected_access
FROM user_features
WHERE subscription_status IS NOT NULL
LIMIT 10;
```
- **Expected**: `has_full_access` should match `expected_access` for all rows
- **Action if fails**: Verify view migration ran correctly

#### Validation Query 10: user_features.early_bird_eligible Column Exists
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_features' 
  AND column_name = 'early_bird_eligible';
```
- **Expected**: One row with column_name='early_bird_eligible', data_type='boolean'
- **Action if fails**: Re-run user_features view migration

### Stripe Webhook Testing

#### 1. Test Lifetime Purchase (`checkout.session.completed` with `mode=payment`)
- [ ] Complete a lifetime purchase in Stripe test mode
- [ ] Verify webhook log shows: `Lifetime entitlement upserted`
- [ ] Query DB: Verify `is_lifetime=true`, `tier='lifetime'`, `status='active'`, `stripe_subscription_id IS NULL`
- [ ] App should show "Lifetime Plan Active"

#### 2. Test Recurring Subscription Creation (`customer.subscription.created`)
- [ ] Create a test subscription in Stripe
- [ ] Verify webhook log shows: `Subscription upserted` with correct tier
- [ ] Query DB: Verify `is_lifetime=false`, `tier` matches price_id, `status` matches Stripe, `stripe_subscription_id` populated
- [ ] App should show subscription as active if status is 'active' or 'trialing'

#### 3. Test Subscription Update (`customer.subscription.updated`)
- [ ] Update subscription status in Stripe (e.g., change tier)
- [ ] Verify webhook updates DB correctly
- [ ] App should reflect new status immediately

#### 4. Test Payment Failed (`invoice.payment_failed`)
- [ ] Trigger a failed payment in Stripe test mode
- [ ] Verify webhook log shows: `Subscription status updated to past_due`
- [ ] Query DB: Verify `status='past_due'`
- [ ] App should show "Payment Required" message with "Update Payment" button
- [ ] App should NOT grant Pro access (user should see upgrade prompts)

#### 5. Test Subscription Cancellation (`customer.subscription.deleted`)
- [ ] Cancel a subscription in Stripe
- [ ] Verify webhook log shows: `Subscription marked as canceled`
- [ ] Query DB: Verify `status='canceled'`
- [ ] App should show "Subscription Canceled" with "Upgrade Now" button
- [ ] App should NOT grant Pro access

#### 6. Test Payment Success (`invoice.paid`)
- [ ] After fixing payment method, verify invoice.paid updates status to 'active'
- [ ] App should restore Pro access

### Frontend Validation

#### Active Subscription Display
- [ ] User with `is_lifetime=true` and `status='active'` → Shows "Lifetime Plan Active"
- [ ] User with `status='active'` recurring → Shows "Pro/Growth/Essential Plan Active" with expiry date
- [ ] User with `status='trialing'` → Shows plan as active
- [ ] User with `status='past_due'` → Shows "Payment Required" with update button
- [ ] User with `status='canceled'` → Shows "Subscription Canceled" with upgrade button

#### Access Control
- [ ] User with `status='past_due'` → Photo upload blocked, shows upgrade prompts
- [ ] User with `status='canceled'` → Photo upload blocked, shows upgrade prompts
- [ ] User with `status='active'` or `status='trialing'` → Full Pro access
- [ ] User with `is_lifetime=true` → Full access regardless of date

#### Edge Cases
- [ ] User with `status='active'` but `current_period_end` in past → Access denied (period ended)
- [ ] User with `is_lifetime=true` but `status='canceled'` → Access denied (lifetime can be canceled)
- [ ] User with multiple old subscription rows (before cleanup) → Only one row remains after cleanup

### Stripe Portal Validation

- [ ] Stripe Dashboard shows subscription as `past_due` → App shows "Payment Required"
- [ ] Stripe Dashboard shows subscription as `canceled` → App shows "Subscription Canceled"
- [ ] Stripe Dashboard shows subscription as `active` → App shows plan as active
- [ ] Stripe Dashboard shows subscription as `trialing` → App shows plan as active

### Security Checks

- [ ] Webhook signature verification is enabled (check logs for "Webhook verified")
- [ ] Users cannot manually set `is_lifetime=true` (RLS policies prevent user modifications)
- [ ] Users cannot modify subscription status (RLS policies prevent user modifications)
- [ ] Only webhook (service_role) can update subscriptions

### Performance Checks

- [ ] `getActiveSubscription` query is fast (uses `maybeSingle()` with `user_id` index)
- [ ] Frontend subscription status checks are memoized
- [ ] Realtime subscription updates work correctly (instant UI updates)

## Common Issues & Solutions

### Issue: User has Pro access but shouldn't
- **Check**: Query `SELECT * FROM subscriptions WHERE user_id = '...'` - verify `status` is not 'past_due' or 'canceled'
- **Fix**: Webhook may not have fired. Manually trigger webhook or update DB directly.

### Issue: User doesn't have Pro access but should
- **Check**: Query subscription row - verify `status='active'` or `status='trialing'`
- **Check**: For lifetime, verify `is_lifetime=true` AND `status='active'`
- **Fix**: Webhook may have failed. Check webhook logs, manually update if needed.

### Issue: Duplicate subscription rows
- **Check**: Run `SELECT user_id, COUNT(*) FROM subscriptions GROUP BY user_id HAVING COUNT(*) > 1;`
- **Fix**: Run cleanup migration again or manually delete duplicates.

### Issue: Invalid tier values
- **Check**: Query for invalid tiers: `SELECT * FROM subscriptions WHERE tier NOT IN ('essential', 'growth', 'pro', 'lifetime');`
- **Fix**: Run cleanup migration again or manually update tiers.

---

**Last Updated**: January 25, 2025
**Version**: 1.0
