import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Undo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';

interface QuickMoodTrackerProps {
  className?: string;
}

export const QuickMoodTracker = ({ className = '' }: QuickMoodTrackerProps) => {
  const [selectedMood, setSelectedMood] = useState<'good' | 'bad' | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  // Load today's mood on component mount
  useEffect(() => {
    loadTodayMood();
  }, []);

  const loadTodayMood = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('lifestyle_entries')
        .select('mood')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading today mood:', error);
        return;
      }

      if (data?.mood === 'good' || data?.mood === 'bad') {
        setSelectedMood(data.mood);
      }
    } catch (error) {
      console.error('Error in loadTodayMood:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleMoodSelect = async (mood: 'good' | 'bad') => {
    if (loading || mood === selectedMood) return;

    setLoading(true);
    const optimisticMood = mood;
    const previousMood = selectedMood;
    
    // Optimistic update
    setSelectedMood(optimisticMood);

    try {
      const { data, error } = await supabase.rpc('set_daily_mood', {
        mood_value: mood
      });

      if (error) throw error;

      // Analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'mood_logged', {
          mood: mood
        });
      }

      // Parse the JSON response
      const result = data as { firstOfDay: boolean; currentStreak: number; longestStreak: number };

      // Celebration for first action of day
      if (result.firstOfDay) {
        // Emit analytics
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'first_action_of_day', {
            source: 'mood'
          });
          (window as any).gtag('event', 'streak_celebrate', {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = format(new Date(), 'yyyy-MM-dd');
      
      if (previousMood === null) {
        // Clear mood entirely
        const { error } = await supabase
          .from('lifestyle_entries')
          .update({ 
            mood: null, 
            mood_set_at: null,
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', user.id)
          .eq('date', today);

        if (error) throw error;
      } else {
        // Revert to previous mood
        const { data, error } = await supabase.rpc('set_daily_mood', {
          mood_value: previousMood
        });

        if (error) throw error;
      }

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