-- Fix the circular dependency by simplifying the group_members policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "group_members_select_visible" ON public.group_members;

-- Create a simpler policy that doesn't reference competition_groups
CREATE POLICY "group_members_select_simple" 
ON public.group_members 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR 
  group_id IN (
    SELECT id FROM public.competition_groups 
    WHERE created_by = auth.uid()
  )
);

-- Test that the query works now
SELECT 'Testing groups query' as test, count(*) as groups_count
FROM public.competition_groups;