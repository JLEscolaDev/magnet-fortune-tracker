-- Fix the RLS policy for group invitations insert
DROP POLICY IF EXISTS "group_invitations_insert_creator" ON group_invitations;

-- Create a proper policy that allows group creators to invite users
CREATE POLICY "group_invitations_insert_creator" ON group_invitations
FOR INSERT 
WITH CHECK (
  invited_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM competition_groups 
    WHERE id = group_invitations.group_id 
    AND created_by = auth.uid()
  )
);