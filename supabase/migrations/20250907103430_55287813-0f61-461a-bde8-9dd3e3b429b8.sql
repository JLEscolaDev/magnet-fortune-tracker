-- The issue might be that auth.uid() is null in the security definer function
-- Let's create a non-security definer version to test

-- First, let's check what auth.uid() returns in the policy context
SELECT 
  'Direct policy test' as test,
  auth.uid() as current_user_in_policy,
  CASE 
    WHEN auth.uid() IS NULL THEN 'User ID is NULL!'
    ELSE 'User ID exists'
  END as user_status;

-- Let's also test the function with the actual current user ID
SELECT 
  'Function test with hardcoded ID' as test,
  public.can_view_competition_group(
    'e334e601-b32e-4300-bd97-c610711b995f'::uuid, 
    '6280b43c-9360-4fa8-93bf-c73a878e1621'::uuid
  ) as should_see_with_current_user;