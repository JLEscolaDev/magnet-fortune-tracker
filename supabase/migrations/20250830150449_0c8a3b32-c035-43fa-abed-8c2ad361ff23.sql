-- Fix search_path for the security definer function with CASCADE
DROP FUNCTION IF EXISTS public.is_user_group_member(UUID, UUID) CASCADE;

-- Recreate the function with proper search_path
CREATE OR REPLACE FUNCTION public.is_user_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = check_group_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = 'public';

-- Recreate the RLS policy
CREATE POLICY "group_members_select_visible" ON public.group_members
FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_members.group_id AND created_by = auth.uid()
  ) OR
  public.is_user_group_member(group_members.group_id, auth.uid())
);