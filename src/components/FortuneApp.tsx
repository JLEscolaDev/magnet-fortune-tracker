import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { TopBar } from '@/components/TopBar';
import { SettingsDrawer } from '@/components/SettingsDrawer';
import { HomeTab } from '@/components/HomeTab';
import { InsightsTab } from '@/components/InsightsTab';
import { TabBar } from '@/components/TabBar';
import { DesktopTabs } from '@/components/DesktopTabs';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { AddFortuneModal } from '@/components/AddFortuneModal';
import { AuthPage } from '@/pages/AuthPage';

const FortuneApp = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'insights'>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addFortuneOpen, setAddFortuneOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleFortuneAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto">
        <TopBar onSettingsClick={() => setSettingsOpen(true)} />
        
        <DesktopTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onAddFortuneClick={() => setAddFortuneOpen(true)}
        />

        <main className="relative">
          {activeTab === 'home' && (
            <HomeTab refreshTrigger={refreshTrigger} />
          )}
          {activeTab === 'insights' && (
            <InsightsTab refreshTrigger={refreshTrigger} />
          )}
        </main>

        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <FloatingActionButton onClick={() => setAddFortuneOpen(true)} />

        <SettingsDrawer
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />

        <AddFortuneModal
          isOpen={addFortuneOpen}
          onClose={() => setAddFortuneOpen(false)}
          onFortuneAdded={handleFortuneAdded}
        />
      </div>
    </div>
  );
};

export default FortuneApp;