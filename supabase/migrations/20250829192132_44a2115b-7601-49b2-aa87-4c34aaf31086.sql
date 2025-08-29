-- Create friends table for user connections
CREATE TABLE public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_user_id)
);

-- Create competition groups table
CREATE TABLE public.competition_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.competition_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Friends policies
CREATE POLICY "Users can view their own friendships" 
ON public.friends 
FOR SELECT 
USING (user_id = auth.uid() OR friend_user_id = auth.uid());

CREATE POLICY "Users can create friend requests" 
ON public.friends 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their friend relationships" 
ON public.friends 
FOR UPDATE 
USING (user_id = auth.uid() OR friend_user_id = auth.uid());

CREATE POLICY "Users can delete their friend relationships" 
ON public.friends 
FOR DELETE 
USING (user_id = auth.uid() OR friend_user_id = auth.uid());

-- Competition groups policies
CREATE POLICY "Users can view groups they're members of" 
ON public.competition_groups 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = id AND user_id = auth.uid()
  )
);

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

-- Group members policies
CREATE POLICY "Users can view group memberships for their groups" 
ON public.group_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_id AND created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.group_members gm2 
    WHERE gm2.group_id = group_id AND gm2.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join groups they're invited to" 
ON public.group_members 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups" 
ON public.group_members 
FOR DELETE 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_id AND created_by = auth.uid()
  )
);

-- Add updated_at trigger for friends
CREATE TRIGGER update_friends_updated_at
BEFORE UPDATE ON public.friends
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for competition_groups
CREATE TRIGGER update_competition_groups_updated_at
BEFORE UPDATE ON public.competition_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user stats for competitions
CREATE OR REPLACE FUNCTION public.get_user_competition_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_fortunes', COALESCE(f.total_count, 0),
    'monthly_fortunes', COALESCE(f.monthly_count, 0),
    'weekly_fortunes', COALESCE(f.weekly_count, 0)
  )
  FROM (
    SELECT 
      COUNT(*) as total_count,
      COUNT(*) FILTER (
        WHERE created_at >= date_trunc('month', now())
      ) as monthly_count,
      COUNT(*) FILTER (
        WHERE created_at >= date_trunc('week', now())
      ) as weekly_count
    FROM public.fortunes 
    WHERE user_id = p_user_id
  ) f;
$$;