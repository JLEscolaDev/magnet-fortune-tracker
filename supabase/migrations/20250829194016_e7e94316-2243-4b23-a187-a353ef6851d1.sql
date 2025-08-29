-- Add the missing foreign key constraint for friends table
ALTER TABLE public.friends 
ADD CONSTRAINT friends_friend_user_id_fkey 
FOREIGN KEY (friend_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix the RLS policies for competition_groups to avoid recursion
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Users can view groups they're members of" ON public.competition_groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.competition_groups;  
DROP POLICY IF EXISTS "Group creators can update their groups" ON public.competition_groups;
DROP POLICY IF EXISTS "Group creators can delete their groups" ON public.competition_groups;

-- Create simple, non-recursive policies with new names
CREATE POLICY "competition_groups_select_all" 
ON public.competition_groups 
FOR SELECT 
USING (true);

CREATE POLICY "competition_groups_insert_own" 
ON public.competition_groups 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "competition_groups_update_own" 
ON public.competition_groups 
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "competition_groups_delete_own" 
ON public.competition_groups 
FOR DELETE 
USING (created_by = auth.uid());

-- Fix group_members policies to avoid recursion
DROP POLICY IF EXISTS "Users can view group memberships for their groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups they're invited to" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

CREATE POLICY "group_members_select_all" 
ON public.group_members 
FOR SELECT 
USING (true);

CREATE POLICY "group_members_insert_own" 
ON public.group_members 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "group_members_delete_own" 
ON public.group_members 
FOR DELETE 
USING (user_id = auth.uid());