-- Debug exactly what's happening with auth.uid()
SELECT 
  'RLS Debug' as test,
  auth.uid() as current_auth_uid,
  (
    SELECT created_by FROM competition_groups 
    WHERE id = 'e334e601-b32e-4300-bd97-c610711b995f'
  ) as group_creator,
  auth.uid() = (
    SELECT created_by FROM competition_groups 
    WHERE id = 'e334e601-b32e-4300-bd97-c610711b995f'
  ) as is_creator_check,
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = 'e334e601-b32e-4300-bd97-c610711b995f'::uuid 
    AND user_id = auth.uid()
  ) as is_member_check;

-- Also check which specific group is being returned
SELECT 
  'Groups being returned' as test,
  id,
  name,
  created_by,
  created_by = auth.uid() as created_by_matches
FROM public.competition_groups;