import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { TopBar } from '@/components/TopBar';
import { SettingsDrawer } from '@/components/SettingsDrawer';
import { SettingsPage } from '@/pages/SettingsPage';
import { HomeTab } from '@/components/HomeTab';
import { InsightsTab } from '@/components/InsightsTab';
import { TabBar } from '@/components/TabBar';
import { DesktopTabs } from '@/components/DesktopTabs';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { AddFortuneModal } from '@/components/AddFortuneModal';
import { AuthPage } from '@/pages/AuthPage';
import { DebugPanel } from '@/components/DebugPanel';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';

const FortuneApp = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'insights'>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [addFortuneOpen, setAddFortuneOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedFortuneDate, setSelectedFortuneDate] = useState<Date | null>(null);

  // Enhanced session validation - only bootstrap after Supabase client is ready
  const [clientReady, setClientReady] = useState(false);
  const bootstrapState = useAppBootstrap(sessionInitialized && clientReady ? user : null);

  useEffect(() => {
    let mounted = true;

    const handleSessionError = async () => {
      console.log('[AUTH] Session error detected, forcing logout');
      try {
        await supabase.auth.signOut();
        localStorage.clear();
      } catch (error) {
        console.error('Error during forced signout:', error);
      }
      if (mounted) {
        setSession(null);
        setUser(null);
        setSessionInitialized(true);
        setAuthLoading(false);
        setClientReady(false);
      }
    };

    const validateSupabaseClientAuth = async (session: Session): Promise<boolean> => {
      try {
        // Make a simple authenticated query to verify the client has proper auth context
        const { data, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('[AUTH] Client auth validation failed:', error.message);
          return false;
        }
        
        if (!data.user || data.user.id !== session.user.id) {
          console.error('[AUTH] Client user mismatch');
          return false;
        }
        
        console.log('[AUTH] Client auth validation successful');
        return true;
      } catch (error) {
        console.error('[AUTH] Client auth validation error:', error);
        return false;
      }
    };

    // Set up auth state listener - this handles all session management
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('[AUTH] Auth state change:', event, session ? 'Session exists' : 'No session');
        
        if (event === 'INITIAL_SESSION') {
          // Check if the initial session is valid
          if (session) {
            // Validate the session by checking if it has required tokens
            if (!session.access_token || !session.refresh_token) {
              console.error('[AUTH] Invalid session tokens detected');
              await handleSessionError();
              return;
            }
            
            // Check if tokens are expired
            const now = Math.floor(Date.now() / 1000);
            if (session.expires_at && session.expires_at < now) {
              console.error('[AUTH] Session tokens expired');
              await handleSessionError();
              return;
            }

            // Add delay to ensure Supabase client context is ready, then validate
            setTimeout(async () => {
              if (!mounted) return;
              
              const isClientReady = await validateSupabaseClientAuth(session);
              if (isClientReady) {
                setClientReady(true);
              } else {
                console.error('[AUTH] Client not ready after validation');
                await handleSessionError();
              }
            }, 100); // Small delay to allow client auth context to update
          } else {
            setClientReady(false);
          }
          
          setSession(session);
          setUser(session?.user ?? null);
          setSessionInitialized(true);
          setAuthLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session) {
            // For new sign-ins and token refreshes, validate client immediately
            const isClientReady = await validateSupabaseClientAuth(session);
            setClientReady(isClientReady);
          } else {
            setClientReady(false);
          }
          
          setSession(session);
          setUser(session?.user ?? null);
          setSessionInitialized(true);
          setAuthLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setSessionInitialized(true);
          setAuthLoading(false);
          setClientReady(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleFortuneAdded = () => {
    // Refetch app state when fortune is added
    bootstrapState.refetch();
    setRefreshTrigger(prev => prev + 1);
    setSelectedFortuneDate(null); // Reset selection after adding
  };

  const handleDateSelect = (date: Date) => {
    setSelectedFortuneDate(date);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="luxury-card p-8 text-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Fortune Magnet...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (showSettingsPage) {
    return <SettingsPage onBack={() => setShowSettingsPage(false)} />;
  }

  return (
    <AppStateProvider value={bootstrapState}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-6xl mx-auto">
          <TopBar onSettingsClick={() => setShowSettingsPage(true)} />
          
          <DesktopTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onAddFortuneClick={() => setAddFortuneOpen(true)}
            selectedDate={selectedFortuneDate}
          />

          <main className="relative">
            {activeTab === 'home' && (
              <HomeTab refreshTrigger={refreshTrigger} />
            )}
            {activeTab === 'insights' && (
              <InsightsTab 
                refreshTrigger={refreshTrigger} 
                onGlobalRefresh={handleFortuneAdded}
                selectedFortuneDate={selectedFortuneDate}
                onDateSelect={handleDateSelect}
              />
            )}
          </main>

          <TabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <FloatingActionButton 
            onClick={() => setAddFortuneOpen(true)} 
            selectedDate={selectedFortuneDate}
          />

          <SettingsDrawer
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />

          <AddFortuneModal
            isOpen={addFortuneOpen}
            onClose={() => setAddFortuneOpen(false)}
            onFortuneAdded={handleFortuneAdded}
            selectedDate={selectedFortuneDate}
          />

          <DebugPanel user={user} />
        </div>
      </div>
    </AppStateProvider>
  );
};

export default FortuneApp;