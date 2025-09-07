-- Fix competition groups RLS policy to make groups private
-- Only allow users to see groups they created or are members of

-- Drop the current overly permissive policy
DROP POLICY IF EXISTS "competition_groups_select_all" ON public.competition_groups;

-- Create a proper private groups policy
CREATE POLICY "competition_groups_select_private" 
ON public.competition_groups 
FOR SELECT 
USING (
  created_by = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = competition_groups.id 
    AND user_id = auth.uid()
  )
);