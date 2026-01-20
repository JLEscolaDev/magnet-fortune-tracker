import { useState, useEffect, useCallback, useRef } from 'react';
import { LuxuryAvatarSection } from './LuxuryAvatarSection';
import { FortuneList } from './FortuneList';
import { DailyQuote } from './DailyQuote';
import { QuickMoodTracker } from './QuickMoodTracker';
import { TaskBoard } from './kanban/TaskBoard';
import { Fortune } from '@/types/fortune';
import { getTodayFortunes, FortuneRecord } from '@/lib/fortunes';
import { useAppState } from '@/contexts/AppStateContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { supabase } from '@/integrations/supabase/client';

interface HomeTabProps {
  refreshTrigger: number;
  onOpenPricing?: () => void;
}

export const HomeTab = ({ refreshTrigger, onOpenPricing }: HomeTabProps) => {
  const { profile, fortunesCountTotal, loading: appLoading } = useAppState();
  const { isStepCompleted, showTutorial, isLoading: tutorialLoading } = useTutorial();
  const [recentFortunes, setRecentFortunes] = useState<FortuneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track if initial fetch has been done to prevent re-fetching on every render
  const initialFetchDoneRef = useRef(false);
  // Track last refresh trigger to avoid re-fetching on same value
  const lastRefreshTriggerRef = useRef(refreshTrigger);

  const fetchRecentFortunes = useCallback(async (force = false) => {
    try {
      setLoading(true);
      console.log("[QUERY:fortunes] Fetching today's fortunes", { force });
      const fortunes = await getTodayFortunes(force);
      setRecentFortunes(fortunes);
      console.log(`[QUERY:fortunes] Fetched ${fortunes?.length ?? 0} recent fortunes`);
    } catch (error) {
      console.error('[QUERY:fortunes] Error in fetchRecentFortunes:', error);
      setRecentFortunes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Stable ref for fetchRecentFortunes
  const fetchRef = useRef(fetchRecentFortunes);
  fetchRef.current = fetchRecentFortunes;

  // All useCallback hooks MUST be before any early returns
  const handleLevelUp = useCallback(() => {
    fetchRef.current(true);
  }, []);

  const handleFortunesUpdated = useCallback(() => {
    fetchRef.current(true);
  }, []);

  // Initial fetch - only once on mount
  useEffect(() => {
    if (!initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true;
      fetchRef.current(false);
    }
  }, []);

  // Handle refresh trigger changes (user action)
  useEffect(() => {
    // Only fetch if refreshTrigger actually changed and is > 0
    if (refreshTrigger > 0 && refreshTrigger !== lastRefreshTriggerRef.current) {
      lastRefreshTriggerRef.current = refreshTrigger;
      fetchRef.current(true);
    }
  }, [refreshTrigger]);

  // Listen for fortune updates to refresh Today's Fortunes list
  // Use debounce to prevent rapid-fire updates
  const eventDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const handleFortuneUpdate = () => {
      // Debounce: ignore if we just handled an event in the last 2 seconds
      if (eventDebounceRef.current) {
        console.log('[HOME-TAB] fortunesUpdated event debounced (ignored)');
        return;
      }
      
      console.log('[HOME-TAB] fortunesUpdated event received - refreshing Today\'s Fortunes list');
      fetchRef.current(true);
      
      // Set debounce flag for 2 seconds
      eventDebounceRef.current = setTimeout(() => {
        eventDebounceRef.current = null;
      }, 2000);
    };

    window.addEventListener("fortunesUpdated", handleFortuneUpdate);
    return () => {
      window.removeEventListener("fortunesUpdated", handleFortuneUpdate);
      if (eventDebounceRef.current) {
        clearTimeout(eventDebounceRef.current);
      }
    };
  }, []);

  // Show home tutorial on first visit
  useEffect(() => {
    if (!loading && !appLoading && !tutorialLoading && !isStepCompleted('home')) {
      const timer = setTimeout(() => {
        showTutorial('home');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [loading, appLoading, tutorialLoading, isStepCompleted, showTutorial]);

  // Early returns AFTER all hooks
  if (loading || appLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="luxury-card p-6 animate-pulse">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-24 h-24 rounded-full bg-muted/30" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted/30 rounded w-20" />
              <div className="h-5 bg-muted/30 rounded w-48" />
              <div className="h-3 bg-muted/30 rounded w-32" />
            </div>
          </div>
        </div>
        <div className="luxury-card p-6 animate-pulse">
          <div className="h-6 bg-muted/30 rounded w-40 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/20 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <div className="luxury-card p-6 text-center">
          <p className="text-muted-foreground">
            Setting up your profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-24 md:pb-6">
      <DailyQuote />
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <LuxuryAvatarSection 
            profile={profile} 
            fortuneCount={fortunesCountTotal}
            onLevelUp={handleLevelUp}
            onOpenPricing={onOpenPricing}
          />
        </div>
        <QuickMoodTracker className="flex-shrink-0" />
      </div>
      <FortuneList 
        fortunes={recentFortunes} 
        title="Today's Fortunes"
        onFortunesUpdated={handleFortunesUpdated}
      />
      <TaskBoard />
    </div>
  );
};