import React, { useState, Component, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { TopBar } from '@/components/TopBar';
import { SettingsDrawer } from '@/components/SettingsDrawer';
import { SettingsPage } from '@/pages/SettingsPage';
import { HomeTab } from '@/components/HomeTab';
import { PricingDialog } from '@/components/billing/PricingDialog';
import { InsightsTab } from '@/components/InsightsTab';
import FriendsTab from '@/components/FriendsTab';
import { TabBar } from '@/components/TabBar';
import { DesktopTabs } from '@/components/DesktopTabs';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { FortuneModal } from '@/components/FortuneModal';
import { AuthPage } from '@/pages/AuthPage';
import { DebugPanel } from '@/components/DebugPanel';
import { DevTools } from '@/components/DevTools';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { useGroupInviteHandler } from '@/hooks/useGroupInviteHandler';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { TutorialModal } from '@/components/TutorialModal';
import { Button } from '@/components/ui/button';

// Simple Error Boundary component
class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const FortuneApp = () => {
  const { user, session, authLoading, sessionInitialized } = useSubscription();
  const [activeTab, setActiveTab] = useState<'home' | 'insights' | 'friends'>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [addFortuneOpen, setAddFortuneOpen] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedFortuneDate, setSelectedFortuneDate] = useState<Date | null>(null);

  console.log('[AUTH] Bootstrap check user:', user);
  console.log('[BOOTSTRAP] Passing user to useAppBootstrap:', user);
  const bootstrapState = useAppBootstrap(user);
  
  // Handle group invitations from URL parameters
  useGroupInviteHandler(user);

  const handleFortuneAdded = () => {
    // Refetch app state when fortune is added
    bootstrapState.refetch();
    setRefreshTrigger(prev => prev + 1);
    setSelectedFortuneDate(null); // Reset selection after adding
  };

  const handleDateSelect = (date: Date) => {
    setSelectedFortuneDate(date);
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="luxury-card p-8 text-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Fortune Magnet...</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <TutorialProvider>
      {showSettingsPage ? (
        bootstrapState && !bootstrapState.loading && !bootstrapState.bootstrapFailed && bootstrapState.profile ? (
          <AppStateProvider value={bootstrapState}>
            <ErrorBoundary fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="luxury-card p-8 text-center"><p className="text-destructive">Error loading settings</p><Button onClick={() => setShowSettingsPage(false)} className="mt-4">Go Back</Button></div></div>}>
              <SettingsPage onBack={() => setShowSettingsPage(false)} />
            </ErrorBoundary>
          </AppStateProvider>
        ) : (
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="luxury-card p-8 text-center">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading settings...</p>
            </div>
          </div>
        )
      ) : (
        <>
          {/* Wait for session initialization before deciding to show auth page */}
          {authLoading || !sessionInitialized ? (
            <div className="min-h-screen bg-background flex items-center justify-center">
              <div className="luxury-card p-8 text-center">
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading Fortune Magnet...</p>
              </div>
            </div>
          ) : !user ? (
            <AuthPage />
          ) : (
            <>
              {/* Debugging bootstrap state before loading/profile check */}
              {(() => {
                console.log('[BOOTSTRAP DEBUG]', {
                  user,
                  bootstrapLoading: bootstrapState?.loading,
                  profile: bootstrapState?.profile,
                  errors: bootstrapState?.errors
                });
                
                // Wait for bootstrap to complete or fail
                if (!bootstrapState || bootstrapState.loading) {
                  return (
                    <div className="min-h-screen bg-background flex items-center justify-center">
                      <div className="luxury-card p-8 text-center max-w-md">
                        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground mb-2">
                          {bootstrapState?.errors?.length ? "Error loading your profile" : "Loading your profile..."}
                        </p>
                        {bootstrapState?.retryCount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Retry attempt {bootstrapState.retryCount + 1}/3
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                
                // If bootstrap failed completely after all retries, logout and show auth page
                if (bootstrapState.bootstrapFailed) {
                  console.log('[BOOTSTRAP] Bootstrap failed completely, signing out user');
                  supabase.auth.signOut();
                  return <AuthPage />;
                }
                
                // If no profile after successful bootstrap, something is wrong - logout
                if (!bootstrapState.profile) {
                  console.log('[BOOTSTRAP] No profile found after bootstrap, signing out user');
                  supabase.auth.signOut();
                  return <AuthPage />;
                }
                
                return null;
              })()}
              
              {bootstrapState && !bootstrapState.loading && !bootstrapState.bootstrapFailed && bootstrapState.profile && (
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
                          <HomeTab 
                            refreshTrigger={refreshTrigger}
                            onOpenPricing={() => setShowPricingDialog(true)}
                          />
                        )}
                        {activeTab === 'insights' && (
                          <InsightsTab 
                            refreshTrigger={refreshTrigger} 
                            onGlobalRefresh={handleFortuneAdded}
                            selectedFortuneDate={selectedFortuneDate}
                            onDateSelect={handleDateSelect}
                          />
                        )}
                        {activeTab === 'friends' && (
                          <FriendsTab />
                        )}
                      </main>

                      <TabBar
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                      />

                      {activeTab !== 'friends' && (
                        <FloatingActionButton 
                          onClick={() => setAddFortuneOpen(true)} 
                          selectedDate={selectedFortuneDate}
                        />
                      )}

                      <SettingsDrawer
                        isOpen={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                      />

                      <FortuneModal
                        isOpen={addFortuneOpen}
                        onClose={() => setAddFortuneOpen(false)}
                        onFortuneAdded={handleFortuneAdded}
                        selectedDate={activeTab === 'home' ? null : selectedFortuneDate}
                        mode="create"
                      />

                      <PricingDialog
                        isOpen={showPricingDialog}
                        onClose={() => setShowPricingDialog(false)}
                      />

                      <DebugPanel user={user} />
                      <DevTools />
                      <TutorialModal />
                    </div>
                  </div>
                </AppStateProvider>
              )}
            </>
          )}
        </>
      )}
      </TutorialProvider>
    </SettingsProvider>
  );
};

export default FortuneApp;