-- Enable public read access to plans table for all users
-- This allows users to view available subscription plans

-- First, make sure RLS is enabled on plans table
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all users (authenticated and anonymous) to read plans
CREATE POLICY "plans_public_read" ON public.plans
FOR SELECT
TO public
USING (true);

-- Drop any existing restrictive policies that might be blocking access
DROP POLICY IF EXISTS "plans_select_policy" ON public.plans;