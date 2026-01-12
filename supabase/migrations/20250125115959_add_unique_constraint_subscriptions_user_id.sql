-- Add UNIQUE constraint on subscriptions.user_id
-- MUST RUN AFTER cleanup migration (20250125115958_cleanup_subscriptions_duplicates.sql)
-- This ensures there is at most ONE subscription row per user going forward

DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'subscriptions_user_id_key'
  ) THEN
    -- Add unique constraint
    ALTER TABLE public.subscriptions 
    ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
    
    RAISE NOTICE 'Added UNIQUE constraint on subscriptions.user_id';
  ELSE
    RAISE NOTICE 'UNIQUE constraint on subscriptions.user_id already exists';
  END IF;
END $$;
