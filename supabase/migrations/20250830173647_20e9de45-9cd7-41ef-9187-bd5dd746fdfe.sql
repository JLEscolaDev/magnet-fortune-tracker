-- Fix RLS policy for automatic group invitations from shared links
-- The current policy requires the inviter to be both auth.uid() AND the group creator
-- But for shared links, we need to allow the group creator to automatically invite new users
-- even when they're not the current authenticated user

DROP POLICY IF EXISTS "group_invitations_insert_creator" ON public.group_invitations;

-- Create new policy that allows:
-- 1. Group creators to invite users (normal case)
-- 2. Automatic invitations when someone visits a shared link (special case)
CREATE POLICY "group_invitations_insert_policy" 
ON public.group_invitations 
FOR INSERT 
WITH CHECK (
  -- Normal case: user is inviting someone to a group they created
  (invited_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_id AND created_by = auth.uid()
  ))
  OR
  -- Special case: automatic invitation from shared link
  -- The invited_user_id must be the current authenticated user
  -- and invited_by must be the group creator
  (invited_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_id AND created_by = invited_by
  ))
);