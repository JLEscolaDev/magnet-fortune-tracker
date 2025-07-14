import { useState, useEffect } from 'react';
import { CustomCalendar } from '@/components/CustomCalendar';
import { StatisticsDetailModal } from '@/components/StatisticsDetailModal';
import { AchievementsDetailModal } from '@/components/AchievementsDetailModal';
import { Fortune, Achievement } from '@/types/fortune';
import { AchievementCard } from '@/components/AchievementCard';
import { supabase } from '@/integrations/supabase/client';
import { 
  CalendarDots, 
  ChartBar, 
  Trophy,
  Lock,
  CurrencyDollar,
  Heart,
  HeartStraight,
  Sparkle
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { format, isSameDay } from 'date-fns';

interface InsightsTabProps {
  refreshTrigger: number;
}

const mockAchievements: Achievement[] = [
  {
    id: '1',
    title: 'First Fortune',
    description: 'Track your first fortune',
    icon: '🎯',
    state: 'earned',
    requiredCount: 1
  },
  {
    id: '2',
    title: 'Fortune Seeker',
    description: 'Track 10 fortunes',
    icon: '🔍',
    state: 'locked',
    requiredCount: 10
  },
  {
    id: '3',
    title: 'Wealth Magnet',
    description: 'Track 5 wealth fortunes',
    icon: '💰',
    state: 'locked',
    requiredCount: 5,
    category: 'Wealth'
  },
  {
    id: '4',
    title: 'Love Attractor',
    description: 'Track 3 love fortunes',
    icon: '💖',
    state: 'locked',
    requiredCount: 3,
    category: 'Love'
  },
];

export const InsightsTab = ({ refreshTrigger }: InsightsTabProps) => {
  const [fortunes, setFortunes] = useState<Fortune[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedDateFortunes, setSelectedDateFortunes] = useState<Fortune[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStatisticsModal, setShowStatisticsModal] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);

  const fetchFortunes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: fortunesData } = await supabase
        .from('fortunes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fortunesData) {
        setFortunes(fortunesData);
        
        // Filter fortunes for selected date
        if (selectedDate) {
          const dateFortunes = fortunesData.filter(fortune =>
            isSameDay(new Date(fortune.created_at), selectedDate)
          );
          setSelectedDateFortunes(dateFortunes);
        }
      }
    } catch (error) {
      console.error('Error fetching fortunes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFortunes();
  }, [refreshTrigger, selectedDate]);

  const getFortunesByCategory = () => {
    const categories = ['Wealth', 'Health', 'Love', 'Opportunity', 'Other'];
    return categories.map(category => ({
      category,
      count: fortunes.filter(f => f.category === category).length
    }));
  };

  const getDaysWithFortunes = () => {
    return fortunes.map(fortune => new Date(fortune.created_at));
  };

  const handleDateClick = (date: Date, dateFortunes: Fortune[]) => {
    setSelectedDate(date);
    setSelectedDateFortunes(dateFortunes);
  };

  const calculateAchievements = () => {
    return mockAchievements.map(achievement => {
      let progress = 0;
      let isEarned = false;

      switch (achievement.id) {
        case '1': // First Fortune
          progress = fortunes.length > 0 ? 1 : 0;
          isEarned = fortunes.length >= 1;
          break;
        case '2': // Fortune Seeker (10 fortunes)
          progress = fortunes.length;
          isEarned = fortunes.length >= 10;
          break;
        case '3': // Wealth Magnet (5 wealth fortunes)
          progress = fortunes.filter(f => f.category === 'Wealth').length;
          isEarned = progress >= 5;
          break;
        case '4': // Love Attractor (3 love fortunes)
          progress = fortunes.filter(f => f.category === 'Love').length;
          isEarned = progress >= 3;
          break;
        default:
          break;
      }

      return {
        ...achievement,
        state: isEarned ? 'earned' as const : 'locked' as const,
        progress
      };
    });
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="luxury-card p-6 animate-pulse">
          <div className="h-6 bg-muted/30 rounded w-32 mb-4" />
          <div className="h-64 bg-muted/20 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-24 md:pb-6">
      {/* Fortune Calendar */}
      <div className="luxury-card p-6">
        <h3 className="text-lg font-heading font-medium mb-4 flex items-center gap-2">
          <CalendarDots size={24} className="text-gold" />
          Fortune Calendar
        </h3>
        <div className="w-full">
          <CustomCalendar
            fortunes={fortunes}
            onDateClick={handleDateClick}
          />
        </div>
        
        {selectedDate && selectedDateFortunes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-medium mb-2">
              {format(selectedDate, 'MMMM d, yyyy')} - {selectedDateFortunes.length} fortune(s)
            </h4>
            <div className="space-y-2">
              {selectedDateFortunes.map(fortune => (
                <div key={fortune.id} className="text-sm p-2 bg-muted/30 rounded">
                  <span className="text-xs text-gold">{fortune.category}</span>
                  <p className="mt-1">{fortune.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="luxury-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-medium flex items-center gap-2">
            <ChartBar size={24} className="text-gold" />
            Statistics
          </h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowStatisticsModal(true)}
            className="text-gold hover:text-gold/80 hover:bg-gold/10"
          >
            View Details
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-emerald">{fortunes.length}</div>
            <div className="text-sm text-muted-foreground">Total Fortunes</div>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-gold">
              {new Set(getDaysWithFortunes().map(d => d.toDateString())).size}
            </div>
            <div className="text-sm text-muted-foreground">Active Days</div>
          </div>
        </div>
        
        <div className="mt-6 space-y-3">
          {getFortunesByCategory().map(({ category, count }) => (
            <div key={category} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {category === 'Wealth' && <CurrencyDollar size={16} className="text-gold" />}
                {category === 'Health' && <HeartStraight size={16} className="text-red-400" />}
                {category === 'Love' && <Heart size={16} className="text-pink-400" />}
                {category === 'Opportunity' && <Sparkle size={16} className="text-emerald" />}
                <span className="text-sm">{category}</span>
              </div>
              <span className="text-sm font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div className="luxury-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-medium flex items-center gap-2">
            <Trophy size={24} className="text-gold" />
            Achievements
          </h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAchievementsModal(true)}
            className="text-gold hover:text-gold/80 hover:bg-gold/10"
          >
            View All
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {calculateAchievements().map((achievement) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              isEarned={achievement.state === 'earned'}
              progress={achievement.progress}
            />
          ))}
        </div>
      </div>

      {/* Detail Modals */}
      <StatisticsDetailModal
        isOpen={showStatisticsModal}
        onClose={() => setShowStatisticsModal(false)}
        fortunes={fortunes}
      />
      
      <AchievementsDetailModal
        isOpen={showAchievementsModal}
        onClose={() => setShowAchievementsModal(false)}
        achievements={calculateAchievements()}
      />
    </div>
  );
};