-- Fix the circular dependency in RLS policies by creating a security definer function
-- This prevents infinite recursion between competition_groups and group_members policies

-- First, create a security definer function to check group visibility
CREATE OR REPLACE FUNCTION public.can_view_competition_group(group_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User created the group
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_id AND created_by = user_id
  ) OR EXISTS (
    -- User is a member of the group
    SELECT 1 FROM public.group_members 
    WHERE group_id = group_id AND user_id = user_id
  );
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "competition_groups_select_private" ON public.competition_groups;

-- Create a new policy using the security definer function
CREATE POLICY "competition_groups_select_safe" 
ON public.competition_groups 
FOR SELECT 
USING (public.can_view_competition_group(id, auth.uid()));