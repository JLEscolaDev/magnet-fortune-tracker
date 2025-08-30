import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, Trophy, Search, Plus, Crown, Medal, Share2, Copy, LogOut } from 'lucide-react';

interface Friend {
  id: string;
  user_id: string;
  friend_user_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  friend_profile: {
    display_name: string;
    avatar_url: string | null;
  };
  created_at: string;
}

interface CompetitionGroup {
  id: string;
  name: string;
  description: string;
  created_by: string;
  member_count: number;
  is_creator: boolean;
  is_member?: boolean;
}

interface UserStats {
  user_id: string;
  display_name: string;
  total_fortunes: number;
  monthly_fortunes: number;
  weekly_fortunes: number;
}

const FriendsTab: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [groupInvitations, setGroupInvitations] = useState<any[]>([]);
  const [groups, setGroups] = useState<CompetitionGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupStats, setGroupStats] = useState<UserStats[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [isUserMember, setIsUserMember] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadFriends();
    loadGroups();
    loadGroupInvitations();
  }, []);

  const loadFriends = async () => {
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) return;

      // Get both outgoing and incoming friend relationships
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${currentUser.data.user.id},friend_user_id.eq.${currentUser.data.user.id}`);

      if (friendsError) {
        console.error('Error loading friends:', friendsError);
        toast({ title: "Error loading friends", variant: "destructive" });
        return;
      }

      // Then get profile data for each friend
      const friendsWithProfiles = await Promise.all(
        (friendsData || []).map(async (friend) => {
          // Determine which user is the "other" user (not current user)
          const otherUserId = friend.user_id === currentUser.data.user!.id 
            ? friend.friend_user_id 
            : friend.user_id;

          const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', otherUserId)
            .single();

          return {
            ...friend,
            friend_profile: profileData || { display_name: 'Unknown', avatar_url: null },
            is_incoming: friend.friend_user_id === currentUser.data.user!.id // true if current user received the request
          };
        })
      );

      const accepted = friendsWithProfiles.filter(f => f.status === 'accepted');
      // Only show incoming requests (where current user is the recipient)
      const incomingPending = friendsWithProfiles.filter(f => 
        f.status === 'pending' && f.is_incoming
      );
      
      setFriends(accepted as any[]);
      setPendingRequests(incomingPending as any[]);
    } catch (error) {
      console.error('Friends loading error:', error);
      toast({ title: "Error loading friends", variant: "destructive" });
    }
  };

  const loadGroups = async () => {
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) return;

      console.log('Loading groups...');
      
      const { data, error } = await supabase
        .from('competition_groups')
        .select('*');

      if (error) {
        console.error('Error loading groups:', error);
        toast({ title: "Error loading groups", variant: "destructive" });
        return;
      }

      console.log('Groups data:', data);

      // Get member counts and check if current user is a member
      const groupsWithCounts = await Promise.all(
        (data || []).map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          // Check if current user is a member
          const { data: memberData } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', group.id)
            .eq('user_id', currentUser.data.user!.id)
            .maybeSingle();

          setIsUserMember(prev => ({
            ...prev,
            [group.id]: !!memberData
          }));

          return {
            ...group,
            member_count: count || 0,
            is_creator: group.created_by === currentUser.data.user!.id,
            is_member: !!memberData
          };
        })
      );

      console.log('Groups with counts:', groupsWithCounts);
      setGroups(groupsWithCounts);
    } catch (error) {
      console.error('Groups loading error:', error);
      toast({ title: "Error loading groups", variant: "destructive" });
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) return;

      console.log('Searching for users with query:', searchQuery);

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .ilike('display_name', `%${searchQuery.trim()}%`)
        .neq('user_id', currentUser.data.user.id)
        .limit(10);

      if (error) {
        console.error('Error searching users:', error);
        toast({ title: "Error searching users", variant: "destructive" });
        return;
      }

      console.log('Search results:', data);
      setSearchResults(data || []);
    } catch (error) {
      console.error('User search error:', error);
      toast({ title: "Error searching users", variant: "destructive" });
    }
  };

  const sendFriendRequest = async (friendUserId: string) => {
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) return;

      console.log('Sending friend request to:', friendUserId);

      // Check if friendship already exists
      const { data: existingFriendship } = await supabase
        .from('friends')
        .select('id')
        .or(`and(user_id.eq.${currentUser.data.user.id},friend_user_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_user_id.eq.${currentUser.data.user.id})`)
        .single();

      if (existingFriendship) {
        toast({ title: "Friendship already exists or request already sent", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: currentUser.data.user.id,
          friend_user_id: friendUserId,
          status: 'pending'
        });

      if (error) {
        console.error('Error sending friend request:', error);
        toast({ title: "Error sending friend request", variant: "destructive" });
        return;
      }

      toast({ title: "Friend request sent!" });
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      console.error('Friend request error:', error);
      toast({ title: "Error sending friend request", variant: "destructive" });
    }
  };

  const loadGroupInvitations = async () => {
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) return;

      console.log('[GROUP_INVITATIONS] Loading invitations for user:', currentUser.data.user.id);

      const { data, error } = await supabase
        .from('group_invitations')
        .select(`
          *,
          competition_groups(name)
        `)
        .eq('invited_user_id', currentUser.data.user.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Error loading group invitations:', error);
        return;
      }

      console.log('[GROUP_INVITATIONS] Raw data from query:', data);

      // Get the inviter's profile separately for each invitation
      const invitationsWithProfiles = await Promise.all(
        (data || []).map(async (invitation) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', invitation.invited_by)
            .maybeSingle();

          return {
            ...invitation,
            inviter_profile: profileData || { display_name: 'Unknown' }
          };
        })
      );

      console.log('[GROUP_INVITATIONS] Final invitations with profiles:', invitationsWithProfiles);
      setGroupInvitations(invitationsWithProfiles);
    } catch (error) {
      console.error('Group invitations loading error:', error);
    }
  };

  const inviteToGroup = async (friendUserId: string, groupId: string) => {
    try {
      console.log('Inviting user to group:', { friendUserId, groupId });
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) return;

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', friendUserId)
        .maybeSingle();

      if (existingMember) {
        console.log('User is already a member');
        toast({ title: "User is already a member of this group", variant: "destructive" });
        return;
      }

      // Check if invitation already exists
      const { data: existingInvitation } = await supabase
        .from('group_invitations')
        .select('id')
        .eq('group_id', groupId)
        .eq('invited_user_id', friendUserId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvitation) {
        console.log('Invitation already exists');
        toast({ title: "Invitation already sent to this user", variant: "destructive" });
        return;
      }

      // Send invitation instead of directly adding to group
      console.log('Sending invitation...');
      const { error } = await supabase
        .from('group_invitations')
        .insert({
          group_id: groupId,
          invited_user_id: friendUserId,
          invited_by: currentUser.data.user.id
        });

      if (error) {
        console.error('Error sending group invitation:', error);
        toast({ title: "Error sending group invitation", variant: "destructive" });
        return;
      }

      console.log('Invitation sent successfully');
      toast({ title: "Group invitation sent!" });
    } catch (error) {
      console.error('Group invite error:', error);
      toast({ title: "Error sending group invitation", variant: "destructive" });
    }
  };

  const acceptGroupInvitation = async (invitationId: string, groupId: string) => {
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) return;

      // Update invitation status to accepted
      const { error: updateError } = await supabase
        .from('group_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (updateError) {
        console.error('Error accepting invitation:', updateError);
        toast({ title: "Error accepting invitation", variant: "destructive" });
        return;
      }

      // Add user to group
      const { error: insertError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: currentUser.data.user.id
        });

      if (insertError) {
        console.error('Error joining group:', insertError);
        toast({ title: "Error joining group", variant: "destructive" });
        return;
      }

      toast({ title: "Group invitation accepted!" });
      loadGroupInvitations();
      loadGroups();
    } catch (error) {
      console.error('Accept invitation error:', error);
      toast({ title: "Error accepting invitation", variant: "destructive" });
    }
  };

  const declineGroupInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('group_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) {
        console.error('Error declining invitation:', error);
        toast({ title: "Error declining invitation", variant: "destructive" });
        return;
      }

      toast({ title: "Group invitation declined" });
      loadGroupInvitations();
    } catch (error) {
      console.error('Decline invitation error:', error);
      toast({ title: "Error declining invitation", variant: "destructive" });
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    if (error) {
      toast({ title: "Error accepting friend request", variant: "destructive" });
      return;
    }

    toast({ title: "Friend request accepted!" });
    loadFriends();
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;

    const { data, error } = await supabase
      .from('competition_groups')
      .insert({
        name: newGroupName,
        description: newGroupDescription,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error creating group", variant: "destructive" });
      return;
    }

    // Add creator as member
    await supabase
      .from('group_members')
      .insert({
        group_id: data.id,
        user_id: (await supabase.auth.getUser()).data.user?.id
      });

    toast({ title: "Competition group created!" });
    setNewGroupName('');
    setNewGroupDescription('');
    setShowCreateGroup(false);
    loadGroups();
  };

  const loadGroupStats = async (groupId: string) => {
    try {
      console.log('Loading group stats for group:', groupId);
      
      const { data: members, error } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (error) {
        console.error('Error loading group members:', error);
        toast({ title: "Error loading group stats", variant: "destructive" });
        return;
      }

      console.log('Group members:', members);

      const statsPromises = (members || []).map(async (member: any) => {
        // Get profile data
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', member.user_id)
          .single();

        // Get stats
        const { data: statsData, error: statsError } = await supabase.rpc('get_user_competition_stats', {
          p_user_id: member.user_id
        });

        if (statsError) {
          console.error('Error getting stats for user:', member.user_id, statsError);
          return null;
        }

        const stats = statsData as any;
        return {
          user_id: member.user_id,
          display_name: profileData?.display_name || 'Unknown',
          total_fortunes: stats.total_fortunes || 0,
          monthly_fortunes: stats.monthly_fortunes || 0,
          weekly_fortunes: stats.weekly_fortunes || 0
        };
      });

      const stats = (await Promise.all(statsPromises)).filter(Boolean) as UserStats[];
      console.log('Final stats:', stats);
      
      setGroupStats(stats.sort((a, b) => b.monthly_fortunes - a.monthly_fortunes));
    } catch (error) {
      console.error('Group stats loading error:', error);
      toast({ title: "Error loading group stats", variant: "destructive" });
    }
  };

  const viewGroupDetails = (groupId: string) => {
    setSelectedGroup(groupId);
    setShowGroupDetails(true);
    loadGroupStats(groupId);
  };

  const leaveGroup = async (groupId: string) => {
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) return;

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.data.user.id);

      if (error) {
        console.error('Error leaving group:', error);
        toast({ title: "Error leaving group", variant: "destructive" });
        return;
      }

      toast({ title: "Left group successfully" });
      loadGroups(); // Refresh groups
    } catch (error) {
      console.error('Leave group error:', error);
      toast({ title: "Error leaving group", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Friends & Competitions</h1>
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="competitions">Competitions</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          {/* Search Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add Friends
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                />
                <Button onClick={searchUsers} variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              
              {searchQuery.trim() && searchResults.length === 0 ? (
                <div className="p-4 text-center space-y-3 border rounded bg-muted/50">
                  <p className="text-muted-foreground">No users found with that username.</p>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Invite your friends to join!</p>
                    <div className="flex items-center gap-2 p-2 bg-background border rounded">
                      <code className="flex-1 text-sm">https://fortune-magnet.vercel.app/</code>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText('https://fortune-magnet.vercel.app/');
                          toast({ title: "Invite link copied!" });
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div key={user.user_id} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-medium">{user.display_name}</span>
                      <Button
                        size="sm"
                        onClick={() => sendFriendRequest(user.user_id)}
                        disabled={friends.some(f => f.friend_user_id === user.user_id)}
                      >
                        {friends.some(f => f.friend_user_id === user.user_id) ? 'Already Friends' : 'Add Friend'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-medium">{request.friend_profile.display_name}</span>
                      <Button
                        size="sm"
                        onClick={() => acceptFriendRequest(request.id)}
                      >
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Group Invitations */}
          {groupInvitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Group Invitations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {groupInvitations.map((invitation: any) => (
                    <div key={invitation.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{invitation.competition_groups?.name}</span>
                        <p className="text-sm text-muted-foreground">
                          Invited by {invitation.inviter_profile?.display_name}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => acceptGroupInvitation(invitation.id, invitation.group_id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => declineGroupInvitation(invitation.id)}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Friends List */}
          <Card>
            <CardHeader>
              <CardTitle>My Friends ({friends.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No friends yet. Search for users to add!</p>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-medium">{friend.friend_profile.display_name}</span>
                      <span className="text-sm text-muted-foreground">
                        Friends since {new Date(friend.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitions" className="space-y-4">
          {/* Create Group Button */}
          <div className="flex justify-end">
            <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Competition Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Group name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                  />
                  <Button onClick={createGroup} className="w-full">
                    Create Group
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Competition Groups */}
          <div className="grid gap-4">
            {groups.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No competition groups yet. Create one to start competing!</p>
                </CardContent>
              </Card>
            ) : (
              groups.map((group) => (
                <Card key={group.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {group.is_creator && <Crown className="h-4 w-4 text-yellow-500" />}
                        {group.name}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {group.member_count} members
                      </span>
                    </CardTitle>
                    {group.description && (
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      onClick={() => viewGroupDetails(group.id)}
                      variant="outline"
                      className="w-full"
                    >
                      <Trophy className="h-4 w-4 mr-2" />
                      View Competition
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        variant="secondary" 
                        className="flex-1"
                        onClick={() => {
                          const shareUrl = `https://fortune-magnet.vercel.app/?invite_group=${group.id}`;
                          navigator.clipboard.writeText(shareUrl);
                          toast({ title: "Group invite link copied!" });
                        }}
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share Group
                      </Button>
                      {group.is_creator ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="secondary" className="flex-1">
                              <UserPlus className="h-4 w-4 mr-2" />
                              Invite Friends
                            </Button>
                          </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invite Friends to {group.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {friends.length === 0 ? (
                              <p className="text-muted-foreground text-center py-4">
                                You need friends to invite them to groups!
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {friends.map((friend) => (
                                  <div key={friend.id} className="flex items-center justify-between p-2 border rounded">
                                    <span className="font-medium">{friend.friend_profile.display_name}</span>
                                    <Button
                                      size="sm"
                                       onClick={async () => {
                                         // Get current user to determine correct friend ID
                                         const currentUser = await supabase.auth.getUser();
                                         if (!currentUser.data.user) return;
                                         
                                         // Determine the correct user ID to invite (the other person in the friendship)
                                         const otherUserId = friend.user_id === currentUser.data.user.id 
                                           ? friend.friend_user_id 
                                           : friend.user_id;
                                         inviteToGroup(otherUserId, group.id);
                                       }}
                                    >
                                      Invite
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </DialogContent>
                        </Dialog>
                      ) : group.is_member && (
                        <Button 
                          variant="destructive" 
                          className="flex-1"
                          onClick={() => leaveGroup(group.id)}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Leave Group
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Group Details Modal */}
      <Dialog open={showGroupDetails} onOpenChange={setShowGroupDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Competition Leaderboard
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              {groupStats.map((user, index) => (
                <div key={user.user_id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                      {index === 0 && <Crown className="h-4 w-4 text-yellow-500" />}
                      {index === 1 && <Medal className="h-4 w-4 text-gray-400" />}
                      {index === 2 && <Medal className="h-4 w-4 text-amber-600" />}
                      {index > 2 && <span className="text-sm font-medium">{index + 1}</span>}
                    </div>
                    <span className="font-medium">{user.display_name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{user.monthly_fortunes} this month</div>
                    <div className="text-sm text-muted-foreground">
                      {user.weekly_fortunes} this week • {user.total_fortunes} total
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FriendsTab;