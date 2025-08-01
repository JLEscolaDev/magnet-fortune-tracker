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

  // Bootstrap only when session is properly initialized and user is available
  const bootstrapState = useAppBootstrap(sessionInitialized ? user : null);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout;

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
      }
    };

    const validateAndSetSession = async (session: Session | null) => {
      if (session) {
        // Basic validation for session
        if (!session.access_token) {
          console.error('[AUTH] Invalid session - missing access token');
          await handleSessionError();
          return false;
        }
        
        // Check if token is expired (with 5-minute buffer)
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (expiresAt > 0 && now > (expiresAt - fiveMinutes)) {
          console.log('[AUTH] Token expires soon, refreshing...');
          try {
            const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
            if (error || !refreshedSession) {
              console.error('[AUTH] Failed to refresh session:', error);
              await handleSessionError();
              return false;
            }
            session = refreshedSession;
          } catch (error) {
            console.error('[AUTH] Error refreshing session:', error);
            await handleSessionError();
            return false;
          }
        }
      }

      if (mounted) {
        const newUser = session?.user ?? null;
        setSession(session);
        setUser(newUser);
        setSessionInitialized(true);
        setAuthLoading(false);
        
        console.log('[AUTH] Session state set:', {
          hasSession: !!session,
          hasUser: !!newUser,
          userId: newUser?.id,
          sessionInitialized: true
        });
      }
      
      return true;
    };

    const initializeAuth = async () => {
      try {
        console.log('[AUTH] Initializing manual auth check...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AUTH] Error getting session:', error);
          await handleSessionError();
          return;
        }

        const isValid = await validateAndSetSession(session);
        
        if (isValid && session) {
          // Set up periodic session refresh (every 50 minutes)
          refreshInterval = setInterval(async () => {
            console.log('[AUTH] Periodic session refresh...');
            try {
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              await validateAndSetSession(currentSession);
            } catch (error) {
              console.error('[AUTH] Periodic refresh failed:', error);
              await handleSessionError();
            }
          }, 50 * 60 * 1000); // 50 minutes
        }
      } catch (error) {
        console.error('[AUTH] Failed to initialize auth:', error);
        if (mounted) {
          await handleSessionError();
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
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