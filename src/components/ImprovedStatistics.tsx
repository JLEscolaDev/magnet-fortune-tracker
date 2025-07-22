import { useState, useMemo, useEffect } from 'react';
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
import { format, subDays, startOfDay, isAfter, isSameDay, startOfMonth, isSameMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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
  const [customCategories, setCustomCategories] = useState<Record<string, string>>({});
  const [selectedYears, setSelectedYears] = useState<[number, number]>([2023, 2024]);

  // Fetch category colors from database
  useEffect(() => {
    const fetchCategoryColors = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('custom_categories')
          .select('name, color')
          .eq('user_id', user.id);

        if (data) {
          const colorMap = data.reduce((acc, cat) => {
            acc[cat.name] = cat.color;
            return acc;
          }, {} as Record<string, string>);
          setCustomCategories(colorMap);
        }
      } catch (error) {
        console.error('Error fetching category colors:', error);
      }
    };

    fetchCategoryColors();
  }, []);

  // Function to get category color with fallback
  const getCategoryColor = (category: string): string => {
    // First check custom categories from database
    if (customCategories[category]) {
      return customCategories[category];
    }
    
    // Then check default categories
    if (DEFAULT_CATEGORY_COLORS[category as keyof typeof DEFAULT_CATEGORY_COLORS]) {
      return DEFAULT_CATEGORY_COLORS[category as keyof typeof DEFAULT_CATEGORY_COLORS];
    }
    
    // Fallback color
    return '#6B7280';
  };

  const statisticsData = useMemo(() => {
    const now = new Date();
    const daysToShow = timeFilter === '7d' ? 7 : 
                      timeFilter === '14d' ? 14 : 
                      timeFilter === '30d' ? 30 :
                      timeFilter === '6m' ? 180 :
                      365;

    // Year comparison data
    const yearComparisonData = selectedYears.map(year => {
      const yearFortunes = fortunes.filter(f => new Date(f.created_at).getFullYear() === year);
      return {
        year: year.toString(),
        count: yearFortunes.length,
        value: yearFortunes.reduce((sum, f) => sum + (Number(f.fortune_value) || 0), 0)
      };
    });
    
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

    // Determine aggregation level based on timeFilter
    const shouldAggregateMonthly = timeFilter === '6m' || timeFilter === '1y';
    
    let chartData = [];
    
    if (shouldAggregateMonthly) {
      // Monthly aggregation for 6m and 1y
      const monthsToShow = timeFilter === '6m' ? 6 : 12;
      
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const monthStart = startOfMonth(subDays(now, i * 30));
        const monthFortunes = fortunes.filter(fortune => 
          isSameMonth(new Date(fortune.created_at), monthStart)
        );
        
        const categoryBreakdown = uniqueCategories.reduce((acc, category) => {
          acc[category] = monthFortunes.filter(f => f.category === category).length;
          return acc;
        }, {} as Record<string, number>);

        chartData.push({
          date: format(monthStart, 'MMM'),
          fullDate: format(monthStart, 'MMM yyyy'),
          count: monthFortunes.length,
          value: monthFortunes.reduce((sum, f) => sum + (Number(f.fortune_value) || 0), 0),
          ...categoryBreakdown
        });
      }
    } else {
      // Daily aggregation for shorter periods
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = subDays(startOfDay(now), i);
        const dayFortunes = fortunes.filter(fortune => 
          isSameDay(new Date(fortune.created_at), date)
        );
        
        const categoryBreakdown = uniqueCategories.reduce((acc, category) => {
          acc[category] = dayFortunes.filter(f => f.category === category).length;
          return acc;
        }, {} as Record<string, number>);

        chartData.push({
          date: format(date, 'MMM dd'),
          fullDate: format(date, 'MMM dd, yyyy'),
          count: dayFortunes.length,
          value: dayFortunes.reduce((sum, f) => sum + (Number(f.fortune_value) || 0), 0),
          ...categoryBreakdown
        });
      }
    }

    const dailyData = chartData;

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
      progressData,
      categoryChartData,
      totalValue,
      activeDays: uniqueDates.size,
      totalFortunes: fortunes.length,
      uniqueCategories,
      yearComparisonData
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
          <>
            <Button
              variant={compareEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCompareEnabled(!compareEnabled)}
              className="h-8 text-xs"
            >
              Compare Years
            </Button>
            {compareEnabled && (
              <div className="flex gap-2 items-center">
                <select 
                  value={selectedYears[0]} 
                  onChange={(e) => setSelectedYears([parseInt(e.target.value), selectedYears[1]])}
                  className="h-8 px-2 text-xs border rounded bg-background"
                >
                  {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <span className="text-xs">vs</span>
                <select 
                  value={selectedYears[1]} 
                  onChange={(e) => setSelectedYears([selectedYears[0], parseInt(e.target.value)])}
                  className="h-8 px-2 text-xs border rounded bg-background"
                >
                  {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}
          </>
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
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            {compareEnabled && chartView === 'progress' ? (
              <BarChart data={statisticsData.yearComparisonData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="year" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={40}
                  domain={[0, 'dataMax']}
                  tickCount={5}
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
                  name="Total Fortunes"
                />
              </BarChart>
            ) : chartView === 'daily' ? (
              <BarChart data={statisticsData.dailyData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={30}
                  domain={[0, 'dataMax']}
                  tickCount={5}
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
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={30}
                  domain={[0, 'dataMax']}
                  tickCount={5}
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
                {statisticsData.uniqueCategories.slice(0, 6).map((category, index) => (
                  <Bar 
                    key={category}
                    dataKey={category} 
                    stackId="categories"
                    fill={getCategoryColor(category)}
                    name={category}
                  />
                ))}
              </BarChart>
            ) : (
              <LineChart data={statisticsData.progressData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={30}
                  domain={[0, 'dataMax']}
                  tickCount={5}
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
                {statisticsData.uniqueCategories.slice(0, 6).map((category, index) => (
                  <Line 
                    key={category}
                    type="monotone" 
                    dataKey={category} 
                    stroke={getCategoryColor(category)} 
                    strokeWidth={2}
                    name={category}
                    dot={{ fill: getCategoryColor(category), strokeWidth: 2, r: 3 }}
                  />
                ))}
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
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={window.innerWidth > 640 ? 80 : 60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statisticsData.categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name)} />
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