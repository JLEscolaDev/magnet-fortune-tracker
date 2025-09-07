-- Debug why the function returns true
-- Let's check each condition separately

SELECT 
  'Debug conditions' as test,
  '6280b43c-9360-4fa8-93bf-c73a878e1621'::uuid as test_user_id,
  'e334e601-b32e-4300-bd97-c610711b995f'::uuid as test_group_id,
  EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = 'e334e601-b32e-4300-bd97-c610711b995f'::uuid 
    AND created_by = '6280b43c-9360-4fa8-93bf-c73a878e1621'::uuid
  ) as is_creator,
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = 'e334e601-b32e-4300-bd97-c610711b995f'::uuid 
    AND user_id = '6280b43c-9360-4fa8-93bf-c73a878e1621'::uuid
  ) as is_member;