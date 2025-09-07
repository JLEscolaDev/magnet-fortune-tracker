-- Drop and recreate everything to fix the issue
DROP POLICY IF EXISTS "competition_groups_select_safe" ON public.competition_groups;
DROP FUNCTION IF EXISTS public.can_view_competition_group(uuid, uuid);

-- Create a simple, direct RLS policy without a function to avoid any function caching issues
CREATE POLICY "competition_groups_select_restricted" 
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

-- Test the new policy immediately
SELECT 
  'Testing new policy' as test,
  count(*) as visible_groups_count
FROM public.competition_groups;