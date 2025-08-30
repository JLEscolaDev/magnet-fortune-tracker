-- Fix search_path for the security definer function
DROP FUNCTION IF EXISTS public.is_user_group_member(UUID, UUID);

CREATE OR REPLACE FUNCTION public.is_user_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = check_group_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = 'public';