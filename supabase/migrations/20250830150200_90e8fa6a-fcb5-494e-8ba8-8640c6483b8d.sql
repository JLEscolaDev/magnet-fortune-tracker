-- Fix infinite recursion in group_members RLS policy
-- First, create a security definer function to check if user is a group member
CREATE OR REPLACE FUNCTION public.is_user_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = check_group_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop the problematic policy
DROP POLICY IF EXISTS "group_members_select_visible" ON public.group_members;

-- Create a new policy without recursion
CREATE POLICY "group_members_select_visible" ON public.group_members
FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_members.group_id AND created_by = auth.uid()
  ) OR
  public.is_user_group_member(group_members.group_id, auth.uid())
);