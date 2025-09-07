-- Check if RLS is actually enabled on the table
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'competition_groups';

-- Also check if there are any permissive vs restrictive policies
SELECT 
  policyname, 
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'competition_groups';

-- Force enable RLS if it's not enabled
ALTER TABLE public.competition_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_groups FORCE ROW LEVEL SECURITY;