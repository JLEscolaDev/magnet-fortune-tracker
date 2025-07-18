import { useState, useMemo } from 'react';
import { Fortune } from '@/types/fortune';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  Cell
} from 'recharts';
import { 
  CalendarDays, 
  TrendingUp, 
  Target, 
  DollarSign,
  BarChart3
} from 'lucide-react';
import { format, subDays, startOfDay, isAfter, isSameDay } from 'date-fns';

interface ImprovedStatisticsProps {
  fortunes: Fortune[];
}

const COLORS = ['#FFD700', '#FF6B6B', '#FF69B4', '#50C878', '#9B59B6'];

export const ImprovedStatistics = ({ fortunes }: ImprovedStatisticsProps) => {
  const [timeFilter, setTimeFilter] = useState<'7d' | '14d' | '30d'>('14d');

  const statisticsData = useMemo(() => {
    const now = new Date();
    const daysToShow = timeFilter === '7d' ? 7 : timeFilter === '14d' ? 14 : 30;
    
    // Weekly counts (last 7 days including today)
    const weeklyCount = fortunes.filter(fortune => {
      const fortuneDate = new Date(fortune.created_at);
      const sevenDaysAgo = subDays(startOfDay(now), 6); // 6 days ago + today = 7 days
      return isAfter(fortuneDate, sevenDaysAgo) || isSameDay(fortuneDate, now);
    }).length;

    // Daily data for chart
    const dailyData = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = subDays(startOfDay(now), i);
      const dayFortunes = fortunes.filter(fortune => 
        isSameDay(new Date(fortune.created_at), date)
      );
      
      dailyData.push({
        date: format(date, 'MMM dd'),
        count: dayFortunes.length,
        value: dayFortunes.reduce((sum, f) => sum + (Number(f.fortune_value) || 0), 0)
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

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-emerald" />
            <span className="text-sm font-medium">Total Fortunes</span>
          </div>
          <div className="text-2xl font-bold text-emerald">
            {statisticsData.totalFortunes}
          </div>
        </Card>

        <Card className="p-4 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium">Active Days</span>
          </div>
          <div className="text-2xl font-bold text-gold">
            {statisticsData.activeDays}
          </div>
        </Card>

        <Card className="p-4 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium">Past 7 Days</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {statisticsData.weeklyCount}
          </div>
        </Card>

        <Card className="p-4 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium">Total Value</span>
          </div>
          <div className="text-2xl font-bold text-gold">
            ${statisticsData.totalValue.toFixed(2)}
          </div>
        </Card>
      </div>

      {/* Time Filter */}
      <div className="flex gap-2">
        {(['7d', '14d', '30d'] as const).map((period) => (
          <Button
            key={period}
            variant={timeFilter === period ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeFilter(period)}
            className="h-8"
          >
            {period === '7d' ? '7 Days' : period === '14d' ? '14 Days' : '30 Days'}
          </Button>
        ))}
      </div>

      {/* Daily Activity Chart */}
      <Card className="p-6 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-gold" />
          <h3 className="text-lg font-semibold">Daily Activity</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statisticsData.dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
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
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Category Distribution */}
      {statisticsData.categoryChartData.length > 0 && (
        <Card className="p-6 bg-background/50 backdrop-blur-sm">
          <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statisticsData.categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
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
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
};