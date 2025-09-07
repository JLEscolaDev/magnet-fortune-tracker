-- Debug and fix the security definer function
-- The issue is that auth.uid() might return null in the function context

-- Let's recreate the function with proper null handling
DROP FUNCTION IF EXISTS public.can_view_competition_group(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_view_competition_group(group_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN user_id IS NULL THEN false
    ELSE EXISTS (
      -- User created the group
      SELECT 1 FROM public.competition_groups 
      WHERE id = group_id AND created_by = user_id
    ) OR EXISTS (
      -- User is a member of the group
      SELECT 1 FROM public.group_members 
      WHERE group_id = group_id AND user_id = user_id
    )
  END;
$$;

-- Test the updated function
SELECT 
  cg.name,
  cg.created_by,
  auth.uid() as current_user,
  public.can_view_competition_group(cg.id, auth.uid()) as should_see
FROM competition_groups cg
WHERE cg.name = 'Test';