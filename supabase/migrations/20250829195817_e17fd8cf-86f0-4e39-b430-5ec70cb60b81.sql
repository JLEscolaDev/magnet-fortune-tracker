-- Allow users to view basic profile information of other users for friend search
CREATE POLICY "profiles_public_read" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Drop the overly restrictive policies that prevent friend search
DROP POLICY IF EXISTS "profiles_read_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;