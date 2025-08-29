-- First, let's add the missing foreign key constraint for friends table
ALTER TABLE public.friends 
ADD CONSTRAINT friends_friend_user_id_fkey 
FOREIGN KEY (friend_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix the RLS policies for competition_groups to avoid recursion
-- Drop the existing problematic policies
DROP POLICY IF EXISTS "Users can view groups they're members of" ON public.competition_groups;
DROP POLICY IF EXISTS "Group creators can update their groups" ON public.competition_groups;
DROP POLICY IF EXISTS "Group creators can delete their groups" ON public.competition_groups;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view all groups" 
ON public.competition_groups 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create groups" 
ON public.competition_groups 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can update their groups" 
ON public.competition_groups 
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "Group creators can delete their groups" 
ON public.competition_groups 
FOR DELETE 
USING (created_by = auth.uid());

-- Fix group_members policies to avoid recursion
DROP POLICY IF EXISTS "Users can view group memberships for their groups" ON public.group_members;

CREATE POLICY "Users can view group memberships" 
ON public.group_members 
FOR SELECT 
USING (true);

CREATE POLICY "Users can join groups" 
ON public.group_members 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups" 
ON public.group_members 
FOR DELETE 
USING (user_id = auth.uid());