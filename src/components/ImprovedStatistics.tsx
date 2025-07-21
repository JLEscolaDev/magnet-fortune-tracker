import { useState, useMemo } from 'react';
import { Fortune, Achievement } from '@/types/fortune';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AchievementsDetailModal } from '@/components/AchievementsDetailModal';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  CalendarDays, 
  TrendingUp, 
  Target, 
  DollarSign,
  BarChart3,
  Trophy,
  Eye
} from 'lucide-react';
import { format, subDays, startOfDay, isAfter, isSameDay } from 'date-fns';

interface ImprovedStatisticsProps {
  fortunes: Fortune[];
  achievements: Achievement[];
}

const COLORS = ['#FFD700', '#FF6B6B', '#FF69B4', '#50C878', '#9B59B6'];

export const ImprovedStatistics = ({ fortunes, achievements }: ImprovedStatisticsProps) => {
  const [timeFilter, setTimeFilter] = useState<'7d' | '14d' | '30d' | '6m' | '1y'>('14d');
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [chartView, setChartView] = useState<'daily' | 'category' | 'progress'>('daily');

  const statisticsData = useMemo(() => {
    const now = new Date();
    const daysToShow = timeFilter === '7d' ? 7 : 
                      timeFilter === '14d' ? 14 : 
                      timeFilter === '30d' ? 30 :
                      timeFilter === '6m' ? 180 :
                      365;
    
    // Weekly counts (last 7 days including today)
    const weeklyCount = fortunes.filter(fortune => {
      const fortuneDate = new Date(fortune.created_at);
      const sevenDaysAgo = subDays(startOfDay(now), 6); // 6 days ago + today = 7 days
      return isAfter(fortuneDate, sevenDaysAgo) || isSameDay(fortuneDate, now);
    }).length;

    // Daily data for chart with category breakdown
    const dailyData = [];
    const categoryColors = {
      'Health': '#50C878',
      'Money': '#FFD700', 
      'Work': '#FF6B6B',
      'Love': '#FF69B4',
      'Family': '#9B59B6',
      'Friends': '#00CED1',
      'Personal Growth': '#FFA500',
      'Travel': '#32CD32'
    };

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = subDays(startOfDay(now), i);
      const dayFortunes = fortunes.filter(fortune => 
        isSameDay(new Date(fortune.created_at), date)
      );
      
      const categoryBreakdown = dayFortunes.reduce((acc, fortune) => {
        acc[fortune.category] = (acc[fortune.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      dailyData.push({
        date: format(date, timeFilter === '6m' || timeFilter === '1y' ? 'MMM' : 'MMM dd'),
        count: dayFortunes.length,
        value: dayFortunes.reduce((sum, f) => sum + (Number(f.fortune_value) || 0), 0),
        ...categoryBreakdown
      });
    }

    // Category breakdown
    const categoryData = fortunes.reduce((acc, fortune) => {
      acc[fortune.category] = (acc[fortune.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryChartData = Object.entries(categoryData).map(([category, count]) => ({
      name: category,
      value: count
    }));

    // Total monetary value
    const totalValue = fortunes.reduce((sum, fortune) => 
      sum + (Number(fortune.fortune_value) || 0), 0
    );

    // Active days calculation
    const uniqueDates = new Set(
      fortunes.map(fortune => 
        format(new Date(fortune.created_at), 'yyyy-MM-dd')
      )
    );

    return {
      weeklyCount,
      dailyData,
      categoryChartData,
      totalValue,
      activeDays: uniqueDates.size,
      totalFortunes: fortunes.length
    };
  }, [fortunes, timeFilter]);

  const earnedAchievements = achievements.filter(a => a.state === 'earned');
  const recentAchievements = earnedAchievements.slice(-4); // Last 4 earned
  const progressPercentage = (earnedAchievements.length / achievements.length) * 100;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-3 sm:p-4 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-emerald" />
            <span className="text-xs sm:text-sm font-medium">Total Fortunes</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald">
            {statisticsData.totalFortunes}
          </div>
        </Card>

        <Card className="p-3 sm:p-4 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-gold" />
            <span className="text-xs sm:text-sm font-medium">Active Days</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gold">
            {statisticsData.activeDays}
          </div>
        </Card>

        <Card className="p-3 sm:p-4 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="text-xs sm:text-sm font-medium">Past 7 Days</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-400">
            {statisticsData.weeklyCount}
          </div>
        </Card>

        <Card className="p-3 sm:p-4 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-gold" />
            <span className="text-xs sm:text-sm font-medium">Total Value</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gold">
            ${statisticsData.totalValue.toFixed(2)}
          </div>
        </Card>
      </div>

      {/* Time Filter */}
      <div className="flex flex-wrap gap-2">
        {(['7d', '14d', '30d', '6m', '1y'] as const).map((period) => (
          <Button
            key={period}
            variant={timeFilter === period ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeFilter(period)}
            className="h-8 text-xs"
          >
            {period === '7d' ? '7 Days' : 
             period === '14d' ? '14 Days' : 
             period === '30d' ? '30 Days' : 
             period === '6m' ? '6 Months' : 
             '1 Year'}
          </Button>
        ))}
      </div>

      {/* Chart View Toggle */}
      <div className="flex gap-2">
        {(['daily', 'category', 'progress'] as const).map((view) => (
          <Button
            key={view}
            variant={chartView === view ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartView(view)}
            className="h-8 text-xs"
          >
            {view === 'daily' ? 'Daily Activity' : 
             view === 'category' ? 'Category View' : 
             'Progress Lines'}
          </Button>
        ))}
      </div>

      {/* Dynamic Chart */}
      <Card className="p-6 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-gold" />
          <h3 className="text-lg font-semibold">
            {chartView === 'daily' ? 'Daily Activity' : 
             chartView === 'category' ? 'Category Breakdown' : 
             'Progress Tracking'}
          </h3>
        </div>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'daily' ? (
              <BarChart data={statisticsData.dailyData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={30}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="Fortunes"
                />
              </BarChart>
            ) : chartView === 'category' ? (
              <BarChart data={statisticsData.dailyData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={30}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                {Object.keys(statisticsData.dailyData[0] || {})
                  .filter(key => !['date', 'count', 'value'].includes(key))
                  .slice(0, 5)
                  .map((category, index) => (
                    <Bar 
                      key={category}
                      dataKey={category} 
                      stackId="categories"
                      fill={COLORS[index % COLORS.length]}
                      name={category}
                    />
                  ))}
              </BarChart>
            ) : (
              <LineChart data={statisticsData.dailyData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={30}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  name="Daily Fortunes"
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--gold))" 
                  strokeWidth={3}
                  name="Daily Value ($)"
                  dot={{ fill: 'hsl(var(--gold))', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Category Distribution */}
      {statisticsData.categoryChartData.length > 0 && (
        <Card className="p-6 bg-background/50 backdrop-blur-sm">
          <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statisticsData.categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => 
                    window.innerWidth > 640 ? `${name} ${(percent * 100).toFixed(0)}%` : `${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={window.innerWidth > 640 ? 80 : 60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statisticsData.categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Achievements Section */}
      <Card className="p-6 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gold" />
            <h3 className="text-lg font-semibold">Recent Achievements</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAchievementsModal(true)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            View All
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Achievement Progress</span>
            <span className="text-gold font-medium">
              {earnedAchievements.length}/{achievements.length} ({progressPercentage.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-muted/30 rounded-full h-3 shadow-inner">
            <div 
              className="bg-gradient-to-r from-gold to-emerald h-3 rounded-full transition-all duration-1000 shadow-md"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Recent Achievements */}
        {recentAchievements.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-gold/10 to-emerald/10 border border-gold/20"
              >
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gold text-sm truncate">
                    {achievement.title}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {achievement.description}
                  </p>
                </div>
                <Trophy className="h-4 w-4 text-emerald flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Start tracking fortunes to unlock achievements!</p>
          </div>
        )}
      </Card>

      <AchievementsDetailModal
        isOpen={showAchievementsModal}
        onClose={() => setShowAchievementsModal(false)}
        achievements={achievements}
      />
    </div>
  );
};