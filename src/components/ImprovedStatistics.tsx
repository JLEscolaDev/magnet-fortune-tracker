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

const DEFAULT_CATEGORY_COLORS = {
  'Wealth': '#D6B94C',
  'Health': '#50C878', 
  'Love': '#FF69B4',
  'Opportunity': '#9B59B6',
  'Other': '#6B7280'
};

export const ImprovedStatistics = ({ fortunes, achievements }: ImprovedStatisticsProps) => {
  const [timeFilter, setTimeFilter] = useState<'7d' | '14d' | '30d' | '6m' | '1y'>('14d');
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [chartView, setChartView] = useState<'daily' | 'category' | 'progress'>('daily');
  const [compareEnabled, setCompareEnabled] = useState(false);

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

    // Get unique categories from filtered fortunes
    const filteredFortunes = fortunes.filter(fortune => {
      const fortuneDate = new Date(fortune.created_at);
      const cutoffDate = subDays(startOfDay(now), daysToShow - 1);
      return isAfter(fortuneDate, cutoffDate) || isSameDay(fortuneDate, cutoffDate) || isSameDay(fortuneDate, now);
    });

    const uniqueCategories = [...new Set(filteredFortunes.map(f => f.category))];

    // Get category colors (including custom ones with their colors from DB)
    const getCategoryColor = (category: string) => {
      // For fortunes with custom categories, use their stored color if available
      const fortuneWithCategory = fortunes.find(f => f.category === category);
      if (fortuneWithCategory && 'category_color' in fortuneWithCategory && fortuneWithCategory.category_color) {
        return fortuneWithCategory.category_color;
      }
      // Fall back to default colors
      return DEFAULT_CATEGORY_COLORS[category as keyof typeof DEFAULT_CATEGORY_COLORS] || '#6B7280';
    };

    // Aggregate data based on time filter for better readability
    const shouldAggregate = timeFilter === '6m' || timeFilter === '1y';
    const aggregationUnit = timeFilter === '6m' ? 'week' : timeFilter === '1y' ? 'month' : 'day';
    
    let dailyData = [];

    if (shouldAggregate) {
      // Group data by weeks (6m) or months (1y) to reduce visual clutter
      const groupedData = new Map();
      
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = subDays(startOfDay(now), i);
        const dayFortunes = fortunes.filter(fortune => 
          isSameDay(new Date(fortune.created_at), date)
        );
        
        // Create grouping key
        let groupKey;
        if (timeFilter === '6m') {
          // Group by week
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week
          groupKey = format(weekStart, 'MMM dd');
        } else {
          // Group by month
          groupKey = format(date, 'MMM yyyy');
        }
        
        if (!groupedData.has(groupKey)) {
          groupedData.set(groupKey, {
            date: groupKey,
            fullDate: groupKey,
            count: 0,
            value: 0,
            categoryData: uniqueCategories.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {})
          });
        }
        
        const group = groupedData.get(groupKey);
        group.count += dayFortunes.length;
        group.value += dayFortunes.reduce((sum, f) => sum + (Number(f.fortune_value) || 0), 0);
        
        dayFortunes.forEach(fortune => {
          group.categoryData[fortune.category] += 1;
        });
      }
      
      // Convert to array and limit to max 12 data points
      const allGrouped = Array.from(groupedData.values()).reverse();
      const maxPoints = 12;
      const step = Math.ceil(allGrouped.length / maxPoints);
      
      dailyData = allGrouped.filter((_, index) => index % step === 0).map(group => ({
        date: group.date,
        fullDate: group.fullDate,
        count: group.count,
        value: group.value,
        ...group.categoryData
      }));
    } else {
      // Daily data for shorter periods
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = subDays(startOfDay(now), i);
        const dayFortunes = fortunes.filter(fortune => 
          isSameDay(new Date(fortune.created_at), date)
        );
        
        const categoryBreakdown = uniqueCategories.reduce((acc, category) => {
          acc[category] = dayFortunes.filter(f => f.category === category).length;
          return acc;
        }, {} as Record<string, number>);

        dailyData.push({
          date: format(date, 'MMM dd'),
          fullDate: format(date, 'MMM dd, yyyy'),
          count: dayFortunes.length,
          value: dayFortunes.reduce((sum, f) => sum + (Number(f.fortune_value) || 0), 0),
          ...categoryBreakdown
        });
      }
    }

    // Progress Lines data - one line per category
    const progressData = dailyData.map(day => {
      const result = { 
        date: day.date,
        fullDate: day.fullDate
      };
      
      uniqueCategories.forEach(category => {
        result[category] = day[category] || 0;
      });
      
      return result;
    });

    // Category breakdown with consistent colors
    const categoryData = fortunes.reduce((acc, fortune) => {
      acc[fortune.category] = (acc[fortune.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryChartData = Object.entries(categoryData).map(([category, count]) => ({
      name: category,
      value: count,
      color: getCategoryColor(category)
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
      progressData,
      categoryChartData,
      totalValue,
      activeDays: uniqueDates.size,
      totalFortunes: fortunes.length,
      uniqueCategories,
      getCategoryColor
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
      <div className="flex flex-wrap gap-2">
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
        {chartView === 'progress' && (
          <Button
            variant={compareEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCompareEnabled(!compareEnabled)}
            className="h-8 text-xs"
          >
            Compare Years
          </Button>
        )}
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
        <div className="h-48 sm:h-64 overflow-x-auto">
          <div className={`${timeFilter === '6m' || timeFilter === '1y' ? 'min-w-[600px]' : ''}`}>
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'daily' ? (
                <BarChart data={statisticsData.dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    interval={0}
                    tick={{ fontSize: 10 }}
                    angle={timeFilter === '6m' || timeFilter === '1y' ? -45 : 0}
                    textAnchor={timeFilter === '6m' || timeFilter === '1y' ? 'end' : 'middle'}
                    height={timeFilter === '6m' || timeFilter === '1y' ? 60 : 30}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    width={40}
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
                    maxBarSize={timeFilter === '6m' || timeFilter === '1y' ? 40 : 60}
                  />
                </BarChart>
              ) : chartView === 'category' ? (
                <BarChart data={statisticsData.dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    interval={0}
                    tick={{ fontSize: 10 }}
                    angle={timeFilter === '6m' || timeFilter === '1y' ? -45 : 0}
                    textAnchor={timeFilter === '6m' || timeFilter === '1y' ? 'end' : 'middle'}
                    height={timeFilter === '6m' || timeFilter === '1y' ? 60 : 30}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    width={40}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data?.fullDate || label;
                    }}
                  />
                  <Legend />
                  {statisticsData.uniqueCategories.slice(0, 8).map((category) => (
                    <Bar 
                      key={category}
                      dataKey={category} 
                      stackId="categories"
                      fill={statisticsData.getCategoryColor(category)}
                      name={category}
                      maxBarSize={timeFilter === '6m' || timeFilter === '1y' ? 40 : 60}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={statisticsData.progressData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    interval={0}
                    tick={{ fontSize: 10 }}
                    angle={timeFilter === '6m' || timeFilter === '1y' ? -45 : 0}
                    textAnchor={timeFilter === '6m' || timeFilter === '1y' ? 'end' : 'middle'}
                    height={timeFilter === '6m' || timeFilter === '1y' ? 60 : 30}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    width={40}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data?.fullDate || label;
                    }}
                  />
                  <Legend />
                  {statisticsData.uniqueCategories.slice(0, 8).map((category) => (
                    <Line 
                      key={category}
                      type="monotone" 
                      dataKey={category} 
                      stroke={statisticsData.getCategoryColor(category)}
                      strokeWidth={2}
                      name={category}
                      dot={{ fill: statisticsData.getCategoryColor(category), strokeWidth: 2, r: 3 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
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
                    <Cell key={`cell-${index}`} fill={entry.color} />
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