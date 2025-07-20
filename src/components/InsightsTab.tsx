import { useState, useEffect } from 'react';
import { CustomCalendar } from '@/components/CustomCalendar';
import { StatisticsDetailModal } from '@/components/StatisticsDetailModal';
import { AchievementsDetailModal } from '@/components/AchievementsDetailModal';
import { DateDetailsModal } from '@/components/DateDetailsModal';
import { ImprovedStatistics } from '@/components/ImprovedStatistics';
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
  onGlobalRefresh?: () => void;
  selectedFortuneDate?: Date | null;
  onDateSelect?: (date: Date) => void;
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

export const InsightsTab = ({ refreshTrigger, onGlobalRefresh, selectedFortuneDate, onDateSelect }: InsightsTabProps) => {
  const [fortunes, setFortunes] = useState<Fortune[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedDateFortunes, setSelectedDateFortunes] = useState<Fortune[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStatisticsModal, setShowStatisticsModal] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

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
    if (dateFortunes.length > 0) {
      setShowDateModal(true);
    }
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
          selectedDate={selectedFortuneDate}
          onDateSelect={onDateSelect}
        />
        </div>
      </div>

      {/* Statistics */}
      <div className="luxury-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-medium flex items-center gap-2">
            <ChartBar size={24} className="text-gold" />
            Statistics & Insights
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
        <ImprovedStatistics fortunes={fortunes} />
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

      <DateDetailsModal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        date={selectedDate}
        fortunes={selectedDateFortunes}
        onFortunesUpdated={() => {
          fetchFortunes();
          onGlobalRefresh?.();
        }}
      />
    </div>
  );
};