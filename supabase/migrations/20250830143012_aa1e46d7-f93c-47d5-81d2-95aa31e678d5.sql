-- Drop the restrictive insert policy that only allows self-insertion
DROP POLICY IF EXISTS "group_members_insert_own" ON public.group_members;

-- Create a new policy that allows group creators to invite others
CREATE POLICY "group_members_insert_creator_or_self" 
ON public.group_members 
FOR INSERT 
WITH CHECK (
  -- Users can add themselves to groups
  user_id = auth.uid() 
  OR 
  -- Group creators can add others to their groups
  EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_id AND created_by = auth.uid()
  )
);

-- Also update the select policy to be more specific about who can see group memberships
DROP POLICY IF EXISTS "group_members_select_all" ON public.group_members;

CREATE POLICY "group_members_select_visible" 
ON public.group_members 
FOR SELECT 
USING (
  -- Users can see their own memberships
  user_id = auth.uid()
  OR
  -- Users can see memberships of groups they created
  EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_id AND created_by = auth.uid()
  )
  OR
  -- Users can see memberships of groups they are also a member of
  EXISTS (
    SELECT 1 FROM public.group_members gm2 
    WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid()
  )
);