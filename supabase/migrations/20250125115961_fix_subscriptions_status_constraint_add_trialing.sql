-- Fix subscriptions.status CHECK constraint to allow 'trialing' status
-- This constraint is required for Stripe subscriptions which can have 'trialing' status

DO $$
DECLARE
  constraint_name TEXT;
  constraint_found BOOLEAN := false;
  constraint_def TEXT;
BEGIN
  -- Find CHECK constraints that specifically validate the status column
  -- Must check the constraint definition to ensure it's for the status column, not just name matching
  FOR constraint_name, constraint_def IN
    SELECT conname, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND contype = 'c'  -- CHECK constraint
      AND (
        -- Match constraints that reference the status column specifically
        pg_get_constraintdef(oid) LIKE '%status%'
        AND (pg_get_constraintdef(oid) LIKE '%status%IN%' OR pg_get_constraintdef(oid) LIKE '%status%in%' OR pg_get_constraintdef(oid) LIKE '%(status%')
      )
  LOOP
    -- Additional safety: verify the constraint actually checks status column value
    -- It should contain patterns like: status IN (...) or (status ...
    IF constraint_def ~* '(^|\s)status\s+IN\s*\(|\(status\s+IN\s*\(' THEN
      EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS %I', constraint_name);
      RAISE NOTICE 'Dropped status CHECK constraint: % (def: %)', constraint_name, constraint_def;
      constraint_found := true;
    END IF;
  END LOOP;
  
  IF NOT constraint_found THEN
    RAISE NOTICE 'No existing status CHECK constraint found - creating new one';
  END IF;
  
  -- Create new constraint with all Stripe status values including 'trialing'
  ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'active',
    'trialing',      -- Stripe trial period
    'past_due',      -- Payment failed but subscription still active
    'canceled',      -- Subscription canceled
    'unpaid',        -- Payment failed, subscription will cancel
    'incomplete',    -- Payment attempt incomplete
    'incomplete_expired',  -- Payment attempt expired
    'expired'        -- Subscription expired
  ));
  
  RAISE NOTICE 'Created subscriptions_status_check constraint with trialing support';
END $$;
