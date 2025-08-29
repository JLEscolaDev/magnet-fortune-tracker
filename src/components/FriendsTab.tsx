import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, Trophy, Search, Plus, Crown, Medal } from 'lucide-react';

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
  const [groups, setGroups] = useState<CompetitionGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupStats, setGroupStats] = useState<UserStats[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  useEffect(() => {
    loadFriends();
    loadGroups();
  }, []);

  const loadFriends = async () => {
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) return;

      // First get the friends data
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', currentUser.data.user.id);

      if (friendsError) {
        console.error('Error loading friends:', friendsError);
        toast({ title: "Error loading friends", variant: "destructive" });
        return;
      }

      // Then get profile data for each friend
      const friendsWithProfiles = await Promise.all(
        (friendsData || []).map(async (friend) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', friend.friend_user_id)
            .single();

          return {
            ...friend,
            friend_profile: profileData || { display_name: 'Unknown', avatar_url: null }
          };
        })
      );

      const accepted = friendsWithProfiles.filter(f => f.status === 'accepted');
      const pending = friendsWithProfiles.filter(f => f.status === 'pending');
      
      setFriends(accepted as any[]);
      setPendingRequests(pending as any[]);
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

      // Get member counts separately
      const groupsWithCounts = await Promise.all(
        (data || []).map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          return {
            ...group,
            member_count: count || 0,
            is_creator: group.created_by === currentUser.data.user!.id
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

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .ilike('display_name', `%${searchQuery.trim()}%`)
        .neq('user_id', currentUser.data.user.id) // Exclude current user
        .limit(10);

      if (error) {
        console.error('Error searching users:', error);
        toast({ title: "Error searching users", variant: "destructive" });
        return;
      }

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

      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: currentUser.data.user.id,
          friend_user_id: friendUserId
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
    const { data: members, error } = await supabase
      .from('group_members')
      .select(`
        user_id,
        profiles(display_name)
      `)
      .eq('group_id', groupId);

    if (error) {
      toast({ title: "Error loading group stats", variant: "destructive" });
      return;
    }

    const statsPromises = members?.map(async (member: any) => {
      const { data, error } = await supabase.rpc('get_user_competition_stats', {
        p_user_id: member.user_id
      });

      if (error) return null;

      const stats = data as any;
      return {
        user_id: member.user_id,
        display_name: member.profiles?.display_name || 'Unknown',
        total_fortunes: stats.total_fortunes || 0,
        monthly_fortunes: stats.monthly_fortunes || 0,
        weekly_fortunes: stats.weekly_fortunes || 0
      };
    }) || [];

    const stats = (await Promise.all(statsPromises)).filter(Boolean) as UserStats[];
    setGroupStats(stats.sort((a, b) => b.monthly_fortunes - a.monthly_fortunes));
  };

  const viewGroupDetails = (groupId: string) => {
    setSelectedGroup(groupId);
    setShowGroupDetails(true);
    loadGroupStats(groupId);
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
              
              {searchResults.length > 0 && (
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
              )}
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
                  <CardContent>
                    <Button
                      onClick={() => viewGroupDetails(group.id)}
                      variant="outline"
                      className="w-full"
                    >
                      <Trophy className="h-4 w-4 mr-2" />
                      View Competition
                    </Button>
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