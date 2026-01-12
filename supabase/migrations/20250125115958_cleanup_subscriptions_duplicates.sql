-- Cleanup duplicate subscriptions and normalize tier values
-- MUST RUN BEFORE adding UNIQUE constraint on user_id
-- This migration ensures:
-- 1. Users with lifetime (is_lifetime=true OR tier='lifetime') keep the lifetime row, delete/mark canceled others
-- 2. Users without lifetime keep only the most recent row (updated_at DESC, then created_at DESC)
-- 3. Legacy rows with stripe_* fields NULL cannot remain status='active' unless lifetime
-- 4. Normalize tier strictly to ['essential','growth','pro','lifetime']
-- 5. After cleanup: exactly 1 row per user_id

DO $$
DECLARE
  user_record RECORD;
  lifetime_sub RECORD;
  recent_sub RECORD;
  normalized_tier TEXT;
  sub_record RECORD;
BEGIN
  -- STEP 1: Process users with multiple subscription rows
  FOR user_record IN 
    SELECT user_id, COUNT(*) as sub_count
    FROM public.subscriptions
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    -- Check if user has a lifetime subscription (is_lifetime=true OR tier='lifetime')
    SELECT * INTO lifetime_sub
    FROM public.subscriptions
    WHERE user_id = user_record.user_id
      AND (is_lifetime = true OR tier = 'lifetime')
    ORDER BY 
      COALESCE(updated_at, created_at) DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      -- User has lifetime: keep it, delete all others (lifetime always takes precedence)
      DELETE FROM public.subscriptions
      WHERE user_id = user_record.user_id
        AND id != lifetime_sub.id;
      
      -- Normalize tier for lifetime subscription
      normalized_tier := lifetime_sub.tier;
      IF normalized_tier IS NULL OR normalized_tier = '' OR normalized_tier NOT IN ('essential', 'growth', 'pro', 'lifetime') THEN
        normalized_tier := 'lifetime';
      END IF;
      
      -- Ensure is_lifetime flag is set
      UPDATE public.subscriptions
      SET 
        tier = normalized_tier,
        is_lifetime = true
      WHERE id = lifetime_sub.id;
      
      RAISE NOTICE 'User %: Kept lifetime subscription, deleted % other rows', user_record.user_id, user_record.sub_count - 1;
    ELSE
      -- User has no lifetime: keep most recent row (prefer updated_at, fallback to created_at)
      -- Prefer rows with Stripe data (stripe_subscription_id IS NOT NULL)
      SELECT * INTO recent_sub
      FROM public.subscriptions
      WHERE user_id = user_record.user_id
      ORDER BY 
        CASE WHEN stripe_subscription_id IS NOT NULL THEN 1 ELSE 2 END, -- Prefer rows with Stripe ID
        COALESCE(updated_at, created_at) DESC NULLS LAST,
        created_at DESC
      LIMIT 1;

      IF FOUND THEN
        -- Delete all other rows
        DELETE FROM public.subscriptions
        WHERE user_id = user_record.user_id
          AND id != recent_sub.id;
        
        RAISE NOTICE 'User %: Kept most recent subscription, deleted % other rows', user_record.user_id, user_record.sub_count - 1;
      END IF;
    END IF;
  END LOOP;

  -- STEP 2: Normalize tiers and fix legacy rows for ALL subscriptions
  FOR sub_record IN
    SELECT * FROM public.subscriptions
  LOOP
    normalized_tier := sub_record.tier;
    
    -- Convert numeric strings to tier names
    IF sub_record.tier = '3' OR sub_record.tier = '03' THEN
      normalized_tier := 'pro';
    ELSIF sub_record.tier = '2' OR sub_record.tier = '02' THEN
      normalized_tier := 'growth';
    ELSIF sub_record.tier = '1' OR sub_record.tier = '01' THEN
      normalized_tier := 'essential';
    -- If tier is null or invalid, try to infer from plan_id or is_lifetime
    ELSIF sub_record.tier IS NULL OR sub_record.tier = '' OR sub_record.tier NOT IN ('essential', 'growth', 'pro', 'lifetime') THEN
      IF sub_record.is_lifetime = true THEN
        normalized_tier := 'lifetime';
      ELSIF sub_record.plan_id IS NOT NULL THEN
        -- Infer from plan_id patterns
        IF sub_record.plan_id ILIKE '%pro%' OR sub_record.plan_id ILIKE '%lifetime%' THEN
          normalized_tier := 'pro';
        ELSIF sub_record.plan_id ILIKE '%growth%' THEN
          normalized_tier := 'growth';
        ELSIF sub_record.plan_id ILIKE '%essential%' OR sub_record.plan_id ILIKE '%basic%' THEN
          normalized_tier := 'essential';
        ELSE
          normalized_tier := 'essential'; -- Default fallback
        END IF;
      ELSE
        normalized_tier := 'essential'; -- Default fallback
      END IF;
    END IF;
    
    -- STEP 3: Fix legacy rows - cannot have status='active' or 'trialing' with NULL stripe_* fields unless lifetime
    -- Mark as canceled if: non-lifetime, status is active/trialing, and all stripe_* fields are NULL
    IF sub_record.is_lifetime != true 
       AND (sub_record.status = 'active' OR sub_record.status = 'trialing')
       AND sub_record.stripe_subscription_id IS NULL 
       AND sub_record.stripe_customer_id IS NULL 
       AND sub_record.stripe_price_id IS NULL THEN
      
      UPDATE public.subscriptions
      SET 
        tier = normalized_tier,
        status = 'canceled', -- Mark legacy test rows as canceled
        is_lifetime = false
      WHERE id = sub_record.id;
      
      RAISE NOTICE 'User %: Legacy row with NULL stripe_* fields marked as canceled (was status=%)', sub_record.user_id, sub_record.status;
    ELSE
      -- Just normalize tier and ensure is_lifetime flag is correct
      UPDATE public.subscriptions
      SET 
        tier = normalized_tier,
        is_lifetime = CASE WHEN normalized_tier = 'lifetime' THEN true ELSE COALESCE(sub_record.is_lifetime, false) END
      WHERE id = sub_record.id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Subscription cleanup and tier normalization completed';
END $$;

-- Verification: Ensure exactly one row per user after cleanup
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT user_id
    FROM public.subscriptions
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cleanup failed: % users still have duplicate subscription rows', duplicate_count;
  END IF;
  
  RAISE NOTICE 'Verification passed: No duplicate user_ids found';
END $$;
