import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useGroupInviteHandler = (user: any) => {
  useEffect(() => {
    if (!user) return;

    const handleGroupInvite = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const groupId = urlParams.get('invite_group');
      
      if (!groupId) return;

      try {
        // Check if group exists
        const { data: group, error: groupError } = await supabase
          .from('competition_groups')
          .select('id, name, created_by')
          .eq('id', groupId)
          .single();

        if (groupError || !group) {
          toast({ 
            title: "Group not found", 
            description: "The invitation link is invalid or the group no longer exists.",
            variant: "destructive" 
          });
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // Check if user is already a member
        const { data: existingMember } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingMember) {
          toast({ 
            title: "Already a member", 
            description: `You're already a member of ${group.name}!` 
          });
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // Check if there's already a pending invitation
        const { data: existingInvitation } = await supabase
          .from('group_invitations')
          .select('id')
          .eq('group_id', groupId)
          .eq('invited_user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingInvitation) {
          toast({ 
            title: "Invitation already exists", 
            description: `You already have a pending invitation to ${group.name}. Check your Friends tab!` 
          });
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // Create automatic invitation
        const { error: inviteError } = await supabase
          .from('group_invitations')
          .insert({
            group_id: groupId,
            invited_user_id: user.id,
            invited_by: group.created_by
          });

        if (inviteError) {
          console.error('Error creating group invitation:', inviteError);
          toast({ 
            title: "Error processing invitation", 
            variant: "destructive" 
          });
          return;
        }

        toast({ 
          title: "Group invitation received!", 
          description: `You've been invited to join ${group.name}. Check your Friends tab to accept!` 
        });

        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error('Error handling group invite:', error);
        toast({ 
          title: "Error processing invitation", 
          variant: "destructive" 
        });
      }
    };

    handleGroupInvite();
  }, [user]);
};