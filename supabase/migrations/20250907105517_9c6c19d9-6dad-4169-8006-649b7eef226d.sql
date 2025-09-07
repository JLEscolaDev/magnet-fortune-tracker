-- For now, let's create a policy that blocks everything for the new user
-- This will at least prevent the privacy issue
DROP POLICY IF EXISTS "competition_groups_select_basic" ON public.competition_groups;

CREATE POLICY "competition_groups_select_block_all" 
ON public.competition_groups 
FOR SELECT 
USING (false);

-- Test - this should return 0 groups
SELECT 'Block all test' as test, count(*) as visible_groups
FROM public.competition_groups;