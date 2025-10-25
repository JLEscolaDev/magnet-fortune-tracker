import { useState, useEffect } from 'react';
import { useCheckoutSuccess } from '@/hooks/useCheckoutSuccess';
import { ArrowLeft, Moon, Sun, Bell, SpeakerSimpleHigh, SpeakerSimpleSlash, Upload, Camera, SignOut, Crown, Trophy, ChartLine } from '@phosphor-icons/react';
import betaTesterBadge from '@/assets/beta-tester-badge.webp';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { CategoryManager } from '@/components/CategoryManager';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PricingDialog } from '@/components/billing/PricingDialog';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppState } from '@/contexts/AppStateContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { TutorialModal } from '@/components/TutorialModal';

interface SettingsPageProps {
  onBack: () => void;
}

export const SettingsPage = ({ onBack }: SettingsPageProps) => {
  useCheckoutSuccess();
  const { theme, setTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { soundEnabled, setSoundEnabled, animationsEnabled, setAnimationsEnabled, hapticsEnabled, setHapticsEnabled, currency, setCurrency } = useSettings();
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const { toast } = useToast();
  const { isActive, subscription } = useSubscription();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fallbackProfile, setFallbackProfile] = useState<any>(null);
  const [isBetaTester, setIsBetaTester] = useState(false);
  // Safely consume AppState if the provider exists; fall back gracefully when absent.
  let appState: any = null;
  try {
    appState = useAppState();
  } catch (_) {
    appState = null;
  }
  const profile = appState?.profile ?? null;
  const effectiveProfile = profile ?? fallbackProfile;
  const currentLevel = effectiveProfile?.level ?? 1;
  const displayName = effectiveProfile?.display_name ?? effectiveProfile?.displayName ?? userEmail ?? 'Fortune Seeker';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!cancelled) setUserEmail(user?.email ?? null);
        if (!profile && user?.id) {
          const { data: p } = await supabase
            .from('profiles')
            .select('display_name, level, created_at')
            .eq('user_id', user.id)
            .single();
          if (!cancelled) {
            setFallbackProfile(p ?? null);
            // Check beta tester status
            if (p?.created_at) {
              const registrationDate = new Date(p.created_at);
              const cutoffDate = new Date('2026-01-01T00:00:00.000Z');
              setIsBetaTester(registrationDate < cutoffDate);
            }
          }
        } else if (profile?.created_at) {
          // Check beta tester status for existing profile
          const registrationDate = new Date(profile.created_at);
          const cutoffDate = new Date('2026-01-01T00:00:00.000Z');
          if (!cancelled) setIsBetaTester(registrationDate < cutoffDate);
        }
      } catch (_) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [profile]);

  // Avatar + level for Settings preview (reuse AppState to avoid stale level 1)
  const [avatar, setAvatar] = useState<{ url: string | null; title: string | null } | null>(null);

  useEffect(() => {
    const level = effectiveProfile?.level ?? 1;

    let cancelled = false;
    (async () => {
      try {
        // Fetch avatar for the current level
        const { data: av, error } = await supabase
          .from('avatars')
          .select('url,title')
          .eq('level', level)
          .single();

        if (error) {
          console.warn('Settings avatar fetch error:', error);
        }
        if (!cancelled) {
          setAvatar(av ? { url: av.url, title: av.title } : null);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('Settings avatar preview load failed:', e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveProfile?.level]);

  const handleLogout = async () => {
    try {
      console.log('Starting logout process...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        toast({
          title: "Error",
          description: `Failed to sign out: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Logout successful');
        toast({
          title: "Success",
          description: "Signed out successfully",
        });
        // Force page refresh to clear any cached state
        window.location.reload();
      }
    } catch (error) {
      console.error('Unexpected logout error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred during logout",
        variant: "destructive",
      });
    }
  };

  const handleGenerateReports = () => {
    toast({
      title: "Generating Reports",
      description: "Your progress reports are being generated...",
    });
  };

  const handleManageBilling = async () => {
    try {
      setOpeningPortal(true);
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { return_url: `${window.location.origin}/settings` },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No portal URL returned');

      window.location.href = data.url;
    } catch (error: any) {
      console.error('Portal error:', error);
      if (error?.message?.includes('No active subscription') || error?.status === 400) {
        setShowPricingDialog(true);
        toast({
          title: 'Subscription Required',
          description: 'Please subscribe to manage your billing',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to open billing portal',
          variant: 'destructive',
        });
      }
    } finally {
      setOpeningPortal(false);
    }
  };


  // Settings tutorial: show on page mount if not completed
  const { isStepCompleted, showTutorial } = useTutorial();
  useEffect(() => {
    if (!isStepCompleted('settings')) {
      showTutorial('settings');
    }
  }, [isStepCompleted, showTutorial]);

  return (
    <div
      className="min-h-screen bg-background p-6"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-heading font-bold">Settings</h1>
        </div>

        <div className="space-y-6">
          {/* User Profile Section */}
          <div className="luxury-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-heading font-medium">
                {userEmail ?? 'Profile'}
              </h3>
              {isBetaTester && (
                <img
                  src={betaTesterBadge}
                  alt="Beta Tester"
                  className="w-6 h-6"
                />
              )}
            </div>
            <div className="relative w-full max-w-[280px] sm:max-w-[340px] md:max-w-[40vh] aspect-square mx-auto rounded-full overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl mb-4">
              {/* Background Avatar Image */}
              <div className="absolute inset-0">
                {avatar?.url ? (
                  // GIFs animate automatically with <img>
                  <img
                    src={avatar.url}
                    alt={avatar.title || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald via-emerald/80 to-gold flex items-center justify-center">
                    <Crown size={64} weight="fill" className="text-ivory opacity-80" />
                  </div>
                )}
              </div>

              {/* Subtle ring */}
              <div className="absolute inset-0 rounded-full border-2 border-gold/40 pointer-events-none" />

              {/* Dark gradient overlay to improve text contrast */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* Content overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                <h3 className="font-heading text-base font-semibold text-white mb-1 drop-shadow-lg">
                  {displayName}
                </h3>
                <p className="text-xs text-white/80 mb-1">{avatar?.title ?? 'Adventurer'}</p>
                <div className="flex items-center justify-center gap-2">
                  <Trophy size={14} className="text-gold drop-shadow-lg" />
                  <span className="text-gold font-semibold text-xs drop-shadow-lg">Level {currentLevel}</span>
                </div>
              </div>

            </div>
            <div className="space-y-3">
            {isActive ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleGenerateReports}
                  className="w-full justify-center"
                >
                  <ChartLine size={16} className="mr-2" />
                  Generate Progress Reports
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setShowPricingDialog(true)}
                className="w-full justify-center"
              >
                Upgrade to Pro
              </Button>
            )}
          </div>
          </div>

          {/* Preferences */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">Use dark theme</p>
                  </div>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {soundEnabled ? <SpeakerSimpleHigh size={20} /> : <SpeakerSimpleSlash size={20} />}
                  <div>
                    <p className="font-medium">Sound Effects</p>
                    <p className="text-sm text-muted-foreground">Play audio feedback</p>
                  </div>
                </div>
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell size={20} />
                  <div>
                    <p className="font-medium">Animations</p>
                    <p className="text-sm text-muted-foreground">Enable visual effects</p>
                  </div>
                </div>
                <Switch
                  checked={animationsEnabled}
                  onCheckedChange={setAnimationsEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell size={20} />
                  <div>
                    <p className="font-medium">Haptic Feedback</p>
                    <p className="text-sm text-muted-foreground">Vibration on actions</p>
                  </div>
                </div>
                <Switch
                  checked={hapticsEnabled}
                  onCheckedChange={setHapticsEnabled}
                />
              </div>
            </div>
          </div>

          {/* Currency */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Currency</h3>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="JPY">JPY (¥)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category Manager */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Categories</h3>
            <Button 
              variant="outline" 
              onClick={() => setShowCategoryManager(prev => !prev)}
              className="w-full justify-start"
            >
              {showCategoryManager ? 'Hide Categories' : 'Manage Categories'}
            </Button>
            {showCategoryManager && (
              <div className="mt-4 transition-all duration-300">
                <CategoryManager onCategoriesChange={() => {}} />
              </div>
            )}
          </div>

          {/* Billing */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Billing & Subscription</h3>
            {isActive ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald/10 border border-emerald/20 rounded-lg">
                  <p className="font-medium text-emerald">Pro Plan Active</p>
                  <p className="text-sm text-muted-foreground">
                    Valid until {subscription?.current_period_end ? 
                      new Date(subscription.current_period_end).toLocaleDateString() : 
                      'Unknown'
                    }
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  className="w-full justify-start"
                  disabled={openingPortal}
                >
                  {openingPortal ? 'Opening…' : 'Manage Billing'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-muted/50 border border-border rounded-lg">
                  <p className="font-medium">Free Plan</p>
                  <p className="text-sm text-muted-foreground">
                    Limited features available
                  </p>
                </div>
                <Button
                  onClick={() => setShowPricingDialog(true)}
                  className="w-full justify-start"
                >
                  Upgrade to Pro
                </Button>
              </div>
            )}
          </div>

          {/* Account */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Account</h3>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="w-full justify-start"
            >
              <SignOut size={18} className="mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
      
      <PricingDialog 
        isOpen={showPricingDialog} 
        onClose={() => setShowPricingDialog(false)} 
      />
      <TutorialModal />
    </div>
  );
};