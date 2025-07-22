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
    title: 'Fortune Hunter',
    description: 'Track 25 fortunes',
    icon: '🏹',
    state: 'locked',
    requiredCount: 25
  },
  {
    id: '4',
    title: 'Fortune Master',
    description: 'Track 50 fortunes',
    icon: '🏆',
    state: 'locked',
    requiredCount: 50
  },
  {
    id: '5',
    title: 'Fortune Legend',
    description: 'Track 100 fortunes',
    icon: '👑',
    state: 'locked',
    requiredCount: 100
  },
  {
    id: '6',
    title: 'Wealth Magnet',
    description: 'Track 5 wealth fortunes',
    icon: '💰',
    state: 'locked',
    requiredCount: 5,
    category: 'Wealth'
  },
  {
    id: '7',
    title: 'Gold Rush',
    description: 'Track 15 wealth fortunes',
    icon: '🏗️',
    state: 'locked',
    requiredCount: 15,
    category: 'Wealth'
  },
  {
    id: '8',
    title: 'Love Attractor',
    description: 'Track 3 love fortunes',
    icon: '💖',
    state: 'locked',
    requiredCount: 3,
    category: 'Love'
  },
  {
    id: '9',
    title: 'Cupid\'s Favorite',
    description: 'Track 10 love fortunes',
    icon: '💘',
    state: 'locked',
    requiredCount: 10,
    category: 'Love'
  },
  {
    id: '10',
    title: 'Health Guardian',
    description: 'Track 5 health fortunes',
    icon: '🌿',
    state: 'locked',
    requiredCount: 5,
    category: 'Health'
  },
  {
    id: '11',
    title: 'Opportunity Finder',
    description: 'Track 7 opportunity fortunes',
    icon: '🚪',
    state: 'locked',
    requiredCount: 7,
    category: 'Opportunity'
  },
  {
    id: '12',
    title: 'Daily Tracker',
    description: 'Track fortunes for 7 consecutive days',
    icon: '📅',
    state: 'locked',
    requiredCount: 7
  },
  {
    id: '13',
    title: 'Consistency King',
    description: 'Track fortunes for 30 consecutive days',
    icon: '⚡',
    state: 'locked',
    requiredCount: 30
  },
  {
    id: '14',
    title: 'Value Creator',
    description: 'Track fortunes worth $1000 total',
    icon: '💎',
    state: 'locked',
    requiredCount: 1000
  },
  {
    id: '15',
    title: 'Fortune Millionaire',
    description: 'Track fortunes worth $10,000 total',
    icon: '🏛️',
    state: 'locked',
    requiredCount: 10000
  },
  {
    id: '16',
    title: 'Category Explorer',
    description: 'Track fortunes in 3 different categories',
    icon: '🗺️',
    state: 'locked',
    requiredCount: 3
  },
  {
    id: '17',
    title: 'Well-Rounded',
    description: 'Track fortunes in 5 different categories',
    icon: '🎭',
    state: 'locked',
    requiredCount: 5
  },
  {
    id: '18',
    title: 'Early Bird',
    description: 'Track a fortune before 8 AM',
    icon: '🌅',
    state: 'locked',
    requiredCount: 1
  },
  {
    id: '19',
    title: 'Night Owl',
    description: 'Track a fortune after 10 PM',
    icon: '🦉',
    state: 'locked',
    requiredCount: 1
  },
  {
    id: '20',
    title: 'Weekend Warrior',
    description: 'Track fortunes on 5 weekends',
    icon: '🎪',
    state: 'locked',
    requiredCount: 5
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
      const totalFortunes = fortunes.length;
      const categoryFortunes = achievement.category 
        ? fortunes.filter(f => f.category === achievement.category).length 
        : 0;
      
      const totalValue = fortunes.reduce((sum, f) => sum + (Number(f.fortune_value) || 0), 0);
      const uniqueCategories = new Set(fortunes.map(f => f.category)).size;
      
      // Get unique dates for streak calculation
      const fortuneDates = fortunes.map(f => new Date(f.created_at).toDateString());
      const uniqueDates = [...new Set(fortuneDates)].sort();
      
      let progress = 0;
      let isEarned = false;
      
      switch (achievement.id) {
        case '1': // First Fortune
          progress = totalFortunes;
          isEarned = totalFortunes >= 1;
          break;
        case '2': // Fortune Seeker (10)
        case '3': // Fortune Hunter (25)
        case '4': // Fortune Master (50)
        case '5': // Fortune Legend (100)
          progress = totalFortunes;
          isEarned = totalFortunes >= achievement.requiredCount;
          break;
        case '6': // Wealth Magnet
        case '7': // Gold Rush
        case '8': // Love Attractor
        case '9': // Cupid's Favorite
        case '10': // Health Guardian
        case '11': // Opportunity Finder
          progress = categoryFortunes;
          isEarned = categoryFortunes >= achievement.requiredCount;
          break;
        case '12': // Daily Tracker (7 days)
        case '13': // Consistency King (30 days)
          progress = uniqueDates.length;
          isEarned = uniqueDates.length >= achievement.requiredCount;
          break;
        case '14': // Value Creator ($1000)
        case '15': // Fortune Millionaire ($10,000)
          progress = totalValue;
          isEarned = totalValue >= achievement.requiredCount;
          break;
        case '16': // Category Explorer (3 categories)
        case '17': // Well-Rounded (5 categories)
          progress = uniqueCategories;
          isEarned = uniqueCategories >= achievement.requiredCount;
          break;
        case '18': // Early Bird
          progress = fortunes.filter(f => {
            const hour = new Date(f.created_at).getHours();
            return hour < 8;
          }).length;
          isEarned = progress >= 1;
          break;
        case '19': // Night Owl
          progress = fortunes.filter(f => {
            const hour = new Date(f.created_at).getHours();
            return hour >= 22;
          }).length;
          isEarned = progress >= 1;
          break;
        case '20': // Weekend Warrior
          progress = fortunes.filter(f => {
            const day = new Date(f.created_at).getDay();
            return day === 0 || day === 6; // Sunday or Saturday
          }).length;
          isEarned = progress >= achievement.requiredCount;
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
            variant="outline" 
            size="sm"
            onClick={() => setShowStatisticsModal(true)}
            className="h-8 w-8 p-0 rounded-full bg-gradient-to-r from-emerald to-emerald/80 border-emerald/30 text-ivory hover:scale-110 transition-all duration-200 shadow-lg hover:shadow-emerald/30"
          >
            <ChartBar size={16} />
          </Button>
        </div>
        <ImprovedStatistics fortunes={fortunes} achievements={calculateAchievements()} />
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