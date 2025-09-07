-- Update the competition groups policy to handle group loading better
-- The current policy prevents loading groups to check membership
-- We need to allow users to see all groups first, then check membership separately

DROP POLICY IF EXISTS "competition_groups_select_accessible" ON public.competition_groups;

-- Create a more permissive SELECT policy that allows users to see all groups
-- Individual queries can then check membership separately
CREATE POLICY "competition_groups_select_all" 
ON public.competition_groups 
FOR SELECT 
USING (true);