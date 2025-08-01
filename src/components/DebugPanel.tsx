import { useState } from 'react';
import { CaretDown, CaretUp, Bug, User, CreditCard, Calendar, Warning, MagnifyingGlass } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppState } from '@/contexts/AppStateContext';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DebugPanelProps {
  user: SupabaseUser | null;
}

export const DebugPanel = ({ user }: DebugPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { profile, fortunesCountToday, fortunesCountTotal, activeSubscription, loading, errors, clearErrors, refetch } = useAppState();
  const { toast } = useToast();

  const forceProfileSearch = async () => {
    if (!user?.id) {
      toast({
        title: "No User",
        description: "No authenticated user to search for",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    console.log(`[DEBUG] Manual profile search started for user: ${user.id}`);
    
    try {
      // Direct database query to test profile fetch
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log(`[DEBUG] Manual profile query result:`, { 
        data: profileData, 
        error: profileError,
        userId: user.id 
      });

      if (profileError) {
        toast({
          title: "Profile Search Error",
          description: profileError.message,
          variant: "destructive"
        });
        return;
      }

      if (profileData) {
        toast({
          title: "Profile Found!",
          description: `Found profile for ${profileData.display_name || 'Unknown'} (Level ${profileData.level})`,
          variant: "default"
        });
        
        // Also trigger a full refetch to compare
        console.log(`[DEBUG] Triggering full bootstrap refetch after manual search`);
        await refetch();
      } else {
        toast({
          title: "Profile Not Found",
          description: "No profile exists in database for this user",
          variant: "destructive"
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DEBUG] Manual profile search failed:`, error);
      toast({
        title: "Search Failed",
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Only show in development or with debug flag
  const isDebugMode = process.env.NODE_ENV !== 'production' || 
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

  if (!isDebugMode) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] max-w-xs">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="bg-card/90 backdrop-blur">
            <Bug size={16} className="mr-2" />
            Debug Panel
            {isOpen ? <CaretUp size={16} className="ml-2" /> : <CaretDown size={16} className="ml-2" />}
            {errors.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                {errors.length}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <Card className="bg-card/95 backdrop-blur border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bug size={16} />
                System Status
                {loading && (
                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3 text-xs">
              {/* Auth Section */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <User size={14} />
                  <span className="font-medium">Auth</span>
                </div>
                <div className="ml-5 space-y-1 text-muted-foreground">
                  <div>ID: {user?.id ? `${user.id.slice(0, 8)}...` : 'None'}</div>
                  <div>Email: {user?.email || 'None'}</div>
                  <div>Status: <Badge variant={user ? 'default' : 'destructive'} className="text-xs">
                    {user ? 'Authenticated' : 'Not authenticated'}
                  </Badge></div>
                </div>
              </div>

              {/* Profile Section */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <User size={14} />
                  <span className="font-medium">Profile</span>
                </div>
                <div className="ml-5 space-y-1 text-muted-foreground">
                  <div>Loaded: <Badge variant={profile ? 'default' : 'destructive'} className="text-xs">
                    {profile ? 'Yes' : 'No'}
                  </Badge></div>
                  {profile && (
                    <>
                      <div>ID: {profile.id.slice(0, 8)}...</div>
                      <div>Name: {profile.display_name || 'Missing'}</div>
                      <div>Level: {profile.level || 'Missing'}</div>
                      <div>Total Fortunes: {profile.total_fortunes ?? 'Missing'}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Fortunes Section */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={14} />
                  <span className="font-medium">Fortunes</span>
                </div>
                <div className="ml-5 space-y-1 text-muted-foreground">
                  <div>Today: {fortunesCountToday}</div>
                  <div>Total: {fortunesCountTotal}</div>
                </div>
              </div>

              {/* Subscription Section */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard size={14} />
                  <span className="font-medium">Subscription</span>
                </div>
                <div className="ml-5 space-y-1 text-muted-foreground">
                  <div>Status: <Badge variant={activeSubscription ? 'default' : 'secondary'} className="text-xs">
                    {activeSubscription ? 'Active' : 'None'}
                  </Badge></div>
                  {activeSubscription && (
                    <>
                      <div>Plan: {activeSubscription.plan_id}</div>
                      <div>Ends: {new Date(activeSubscription.current_period_end).toLocaleDateString()}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Debug Actions Section */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MagnifyingGlass size={14} />
                  <span className="font-medium">Debug Actions</span>
                </div>
                <div className="ml-5 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={forceProfileSearch}
                    disabled={isSearching || !user}
                    className="h-7 px-3 text-xs w-full"
                  >
                    {isSearching ? (
                      <>
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-2" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <MagnifyingGlass size={12} className="mr-2" />
                        Force Profile Search
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refetch}
                    disabled={loading || !user}
                    className="h-7 px-3 text-xs w-full"
                  >
                    {loading ? (
                      <>
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-2" />
                        Loading...
                      </>
                    ) : (
                      'Refetch All Data'
                    )}
                  </Button>
                </div>
              </div>

              {/* Errors Section */}
              {errors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Warning size={14} className="text-destructive" />
                    <span className="font-medium text-destructive">Recent Errors</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearErrors}
                      className="h-5 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="ml-5 space-y-1">
                    {errors.slice(-3).map((error, index) => (
                      <div key={index} className="text-xs">
                        <div className="font-mono text-destructive">{error.source}</div>
                        <div className="text-muted-foreground truncate">{error.message}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};