-- Fix SECURITY DEFINER view by recreating active_subscription view without SECURITY DEFINER
DROP VIEW IF EXISTS public.active_subscription;

-- Recreate active_subscription view without SECURITY DEFINER (safer approach)
CREATE VIEW public.active_subscription AS
SELECT *
FROM public.subscriptions
WHERE status = 'active'
  AND current_period_end > NOW();

-- Enable RLS on active_subscription view is not possible, but we'll secure the underlying subscriptions table
-- The subscriptions table already has proper RLS policies

-- Fix reflections table - remove overly permissive policy and add proper user-based security
DROP POLICY IF EXISTS "public_dev_rw" ON public.reflections;

-- Add user_id column to reflections table if it doesn't exist
ALTER TABLE public.reflections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on reflections table (if not already enabled)
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;

-- Create proper RLS policies for reflections
CREATE POLICY "Users can view their own reflections" 
ON public.reflections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reflections" 
ON public.reflections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reflections" 
ON public.reflections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reflections" 
ON public.reflections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Fix function search path for existing functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;