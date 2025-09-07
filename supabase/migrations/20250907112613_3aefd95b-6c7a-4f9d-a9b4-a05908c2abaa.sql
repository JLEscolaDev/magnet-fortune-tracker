-- Drop the current restrictive SELECT policy
DROP POLICY IF EXISTS "competition_groups_select_block_all" ON public.competition_groups;

-- Create a proper SELECT policy that allows users to see groups they have access to
CREATE POLICY "competition_groups_select_accessible" 
ON public.competition_groups 
FOR SELECT 
USING (
  -- User is the creator of the group
  created_by = auth.uid()
  OR
  -- User is a member of the group
  EXISTS (
    SELECT 1 
    FROM public.group_members 
    WHERE group_members.group_id = competition_groups.id 
    AND group_members.user_id = auth.uid()
  )
);