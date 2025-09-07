-- Let's see the actual function definition to spot the bug
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'can_view_competition_group' 
AND routine_schema = 'public';

-- Let's also manually test the exact logic of the function
SELECT 
  'Manual function logic test' as test,
  '6280b43c-9360-4fa8-93bf-c73a878e1621'::uuid as user_id,
  '6280b43c-9360-4fa8-93bf-c73a878e1621'::uuid IS NULL as user_id_is_null,
  CASE 
    WHEN '6280b43c-9360-4fa8-93bf-c73a878e1621'::uuid IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.competition_groups 
      WHERE id = 'e334e601-b32e-4300-bd97-c610711b995f'::uuid 
      AND created_by = '6280b43c-9360-4fa8-93bf-c73a878e1621'::uuid
    ) OR EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = 'e334e601-b32e-4300-bd97-c610711b995f'::uuid 
      AND user_id = '6280b43c-9360-4fa8-93bf-c73a878e1621'::uuid
    )
  END as manual_result;