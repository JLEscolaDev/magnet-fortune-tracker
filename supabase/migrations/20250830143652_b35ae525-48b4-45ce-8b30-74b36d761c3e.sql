-- Create group invitations table
CREATE TABLE public.group_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.competition_groups(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.competition_groups(created_by),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate invitations
  UNIQUE(group_id, invited_user_id)
);

-- Enable RLS
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group invitations
CREATE POLICY "group_invitations_select_own" 
ON public.group_invitations 
FOR SELECT 
USING (
  -- Users can see invitations sent to them
  invited_user_id = auth.uid()
  OR
  -- Group creators can see invitations they sent
  invited_by = auth.uid()
);

CREATE POLICY "group_invitations_insert_creator" 
ON public.group_invitations 
FOR INSERT 
WITH CHECK (
  -- Only group creators can send invitations for their groups
  EXISTS (
    SELECT 1 FROM public.competition_groups 
    WHERE id = group_id AND created_by = auth.uid()
  )
  AND invited_by = auth.uid()
);

CREATE POLICY "group_invitations_update_recipient" 
ON public.group_invitations 
FOR UPDATE 
USING (
  -- Only the invited user can update their invitation (accept/decline)
  invited_user_id = auth.uid()
);

CREATE POLICY "group_invitations_delete_creator_or_recipient" 
ON public.group_invitations 
FOR DELETE 
USING (
  -- Creator can delete invitations they sent, recipient can delete invitations sent to them
  invited_by = auth.uid() OR invited_user_id = auth.uid()
);

-- Add trigger for updated_at
CREATE TRIGGER update_group_invitations_updated_at
  BEFORE UPDATE ON public.group_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();