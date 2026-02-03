import { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, Undo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { listLifestyleEntries, upsertLifestyleEntry } from '@/lib/edge-functions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/auth/AuthProvider';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import '@/types/gtag.d';

interface QuickMoodTrackerProps {
  className?: string;
}

export const QuickMoodTracker = ({ className = '' }: QuickMoodTrackerProps) => {
  const [selectedMood, setSelectedMood] = useState<'good' | 'bad' | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadTodayMood = useCallback(async () => {
    try {
      if (!user) return;

      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await listLifestyleEntries({
        from: today,
        to: today,
        limit: 1,
      });

      if (error) {
        console.error('Error loading today mood:', error);
        return;
      }

      const entries = (data as any)?.entries ?? [];

      const firstRow = Array.isArray(entries) && entries.length > 0 ? (entries as any)[0] : null;
      const moodValue = firstRow?.mood ?? null;

      if (moodValue) {
        if (moodValue === 'good' || moodValue === 'very_good') {
          setSelectedMood('good');
        } else if (moodValue === 'bad' || moodValue === 'very_bad') {
          setSelectedMood('bad');
        } else {
          setSelectedMood(null); // neutral or other detailed entries
        }
      } else {
        setSelectedMood(null);
      }
    } catch (error) {
      console.error('Error in loadTodayMood:', error);
    } finally {
      setInitialLoading(false);
    }
  }, [user]);

  // Load today's mood on component mount
  useEffect(() => {
    if (user) {
      loadTodayMood();
    }
  }, [user, loadTodayMood]);

  // Listen for lifestyle data updates from other components
  useEffect(() => {
    const handleLifestyleUpdate = () => {
      loadTodayMood();
    };

    window.addEventListener('lifestyleDataUpdated', handleLifestyleUpdate);
    return () => window.removeEventListener('lifestyleDataUpdated', handleLifestyleUpdate);
  }, [user, loadTodayMood]);

  const handleMoodSelect = async (mood: 'good' | 'bad') => {
    if (loading || mood === selectedMood) return;

    setLoading(true);
    const optimisticMood = mood;
    const previousMood = selectedMood;

    // Optimistic update
    setSelectedMood(optimisticMood);

    try {
      if (!user) {
        setSelectedMood(previousMood);
        setLoading(false);
        return;
      }
      const today = format(new Date(), 'yyyy-MM-dd');
      // Upsert mood via Edge Function
      const { error: upsertError } = await upsertLifestyleEntry({ date: today, mood });
      if (upsertError) throw upsertError;

      // After upsert, track daily action
      let result: { firstOfDay?: boolean; currentStreak?: number; longestStreak?: number } = {};
      try {
        const { data: streakData, error: streakError } = await supabase.rpc('track_daily_action', {
          source_type: 'mood',
          event_ts: new Date().toISOString(),
        });
        if (streakError) {
          console.error('[RPC] track_daily_action error:', streakError);
        }
        result = streakData as any || {};
      } catch (streakError) {
        console.error('Error tracking daily action:', streakError);
      }

      // Emit event to sync with other components
      window.dispatchEvent(new CustomEvent('lifestyleDataUpdated'));

      // Analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'mood_logged', {
          mood: mood
        });
      }

      // Celebration for first action of day
      if (result?.firstOfDay) {
        // Emit analytics
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'first_action_of_day', {
            source: 'mood'
          });
          window.gtag('event', 'streak_celebrate', {
            currentStreak: result.currentStreak
          });
        }

        // Confetti celebration
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347'],
        });

        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(15);
        }

        // Toast with streak info
        toast({
          title: `Day ${result.currentStreak} streak! 🎉`,
          description: mood === 'good' ? 'Great start to your day!' : 'Tough day, but you\'re tracking it - that\'s progress!',
          duration: 4000,
        });
      }

      // Show undo option
      toast({
        title: mood === 'good' ? 'Good day logged' : 'Tough day logged',
        description: 'Undo',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUndo(previousMood)}
            className="gap-1"
          >
            <Undo className="h-3 w-3" />
            Undo
          </Button>
        ),
        duration: 5000,
      });

    } catch (error) {
      console.error('Error setting mood:', error);
      // Revert optimistic update
      setSelectedMood(previousMood);
      toast({
        title: 'Error',
        description: 'Failed to log mood. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (previousMood: 'good' | 'bad' | null) => {
    if (loading) return;

    setLoading(true);
    const undoMood = selectedMood;

    // Optimistic update
    setSelectedMood(previousMood);

    try {
      if (!user) {
        setSelectedMood(undoMood);
        setLoading(false);
        return;
      }
      const today = format(new Date(), 'yyyy-MM-dd');
      // Always use Edge Function to upsert previousMood (may be null)
      const { error: upsertError } = await upsertLifestyleEntry({
        date: today,
        mood: previousMood,
      });
      if (upsertError) throw upsertError;

      // Emit event to sync with other components
      window.dispatchEvent(new CustomEvent('lifestyleDataUpdated'));

      toast({
        title: 'Mood undone',
        description: 'Your mood tracking has been reverted.',
        duration: 3000,
      });

    } catch (error) {
      console.error('Error undoing mood:', error);
      // Revert optimistic update
      setSelectedMood(undoMood);
      toast({
        title: 'Error',
        description: 'Failed to undo mood. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="h-8 w-8 bg-muted/30 rounded-full animate-pulse" />
        <div className="h-8 w-8 bg-muted/30 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Button
        variant={selectedMood === 'good' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleMoodSelect('good')}
        disabled={loading}
        className={`
          h-10 w-10 p-0 transition-all duration-200
          ${selectedMood === 'good' 
            ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg scale-110' 
            : 'hover:bg-green-50 hover:border-green-200 hover:scale-105'
          }
          ${loading ? 'opacity-50' : ''}
        `}
        aria-label="Log good day"
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      
      <Button
        variant={selectedMood === 'bad' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleMoodSelect('bad')}
        disabled={loading}
        className={`
          h-10 w-10 p-0 transition-all duration-200
          ${selectedMood === 'bad' 
            ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg scale-110' 
            : 'hover:bg-orange-50 hover:border-orange-200 hover:scale-105'
          }
          ${loading ? 'opacity-50' : ''}
        `}
        aria-label="Log tough day"
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
};
