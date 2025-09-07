-- Temporarily disable RLS to test if that fixes the 500 error
DROP POLICY IF EXISTS "competition_groups_select_restricted" ON public.competition_groups;

-- Create a very basic policy that should work
CREATE POLICY "competition_groups_select_basic" 
ON public.competition_groups 
FOR SELECT 
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN false
    ELSE created_by = auth.uid()
  END
);

-- Test the query
SELECT 'Basic policy test' as test, count(*) as visible_groups
FROM public.competition_groups;