-- Test if the RLS policy is actually working
-- Let's check what the function returns for current user
SELECT 
  'Current test' as test_name,
  auth.uid() as current_user_id,
  public.can_view_competition_group('e334e601-b32e-4300-bd97-c610711b995f'::uuid, auth.uid()) as can_view_result;

-- Also check if RLS is actually enabled on the table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'competition_groups';