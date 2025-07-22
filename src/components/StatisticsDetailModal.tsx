import React, { useState } from 'react';
import { X, TrendingUp, Calendar, Target, BarChart3, Filter } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Fortune } from '@/types/fortune';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

interface StatisticsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fortunes: Fortune[];
}

export const StatisticsDetailModal = ({ isOpen, onClose, fortunes }: StatisticsDetailModalProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'all'>('month');

  const categories = ['Wealth', 'Health', 'Love', 'Opportunity', 'Other'];
  const filteredFortunes = selectedCategory 
    ? fortunes.filter(f => f.category === selectedCategory)
    : fortunes;
  const getMonthlyData = () => {
    const currentDate = new Date();
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    return daysInMonth.map(day => ({
      date: format(day, 'MMM d'),
      count: fortunes.filter(fortune => 
        isSameDay(new Date(fortune.created_at), day)
      ).length
    }));
  };

  const getCategoryBreakdown = () => {
    const categories = ['Wealth', 'Health', 'Love', 'Opportunity', 'Other'];
    return categories.map(category => {
      const categoryFortunes = fortunes.filter(f => f.category === category);
      return {
        category,
        count: categoryFortunes.length,
        percentage: fortunes.length > 0 ? ((categoryFortunes.length / fortunes.length) * 100).toFixed(1) : '0'
      };
    }).filter(item => item.count > 0);
  };

  const getStreakData = () => {
    const dates = fortunes.map(f => new Date(f.created_at).toDateString());
    const uniqueDates = [...new Set(dates)].sort();
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;
    
    // Calculate longest streak
    for (let i = 1; i < uniqueDates.length; i++) {
      const currentDate = new Date(uniqueDates[i]);
      const prevDate = new Date(uniqueDates[i - 1]);
      const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    
    // Calculate current streak
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    if (dates.includes(today) || dates.includes(yesterday)) {
      let streakDate = new Date();
      while (dates.includes(streakDate.toDateString())) {
        currentStreak++;
        streakDate = new Date(streakDate.getTime() - 24 * 60 * 60 * 1000);
      }
    }
    
    return { currentStreak, longestStreak };
  };

  const monthlyData = getMonthlyData();
  const categoryData = getCategoryBreakdown();
  const streakData = getStreakData();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-background via-background/98 to-background/95 backdrop-blur-xl border border-gold/30 shadow-2xl">
        {/* Header with single close button */}
        <div className="relative p-6 border-b border-gold/20">
          <div className="text-center">
            <h2 className="text-2xl font-heading font-semibold text-foreground mb-2">Personal Growth Dashboard</h2>
            <p className="text-sm text-muted-foreground">Track your fortune journey and celebrate your progress</p>
          </div>
        </div>

        <div className="p-3 sm:p-6 space-y-6 sm:space-y-8">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="h-8 text-xs"
              >
                All Categories
              </Button>
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="h-8 text-xs"
                >
                  {category}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              {(['week', 'month', 'all'] as const).map(filter => (
                <Button
                  key={filter}
                  variant={timeFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeFilter(filter)}
                  className="h-8 text-xs capitalize"
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-6 bg-gradient-to-br from-gold/10 via-gold/5 to-emerald/10 rounded-xl border border-gold/30 shadow-lg">
              <div className="text-3xl font-bold text-gold mb-1">{filteredFortunes.length}</div>
              <div className="text-sm text-muted-foreground">Total Fortunes</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-emerald/10 via-emerald/5 to-gold/10 rounded-xl border border-emerald/30 shadow-lg">
              <div className="text-3xl font-bold text-emerald mb-1">
                {new Set(filteredFortunes.map(f => new Date(f.created_at).toDateString())).size}
              </div>
              <div className="text-sm text-muted-foreground">Active Days</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-gold/10 rounded-xl border border-primary/30 shadow-lg">
              <div className="text-3xl font-bold text-primary mb-1">{streakData.currentStreak}</div>
              <div className="text-sm text-muted-foreground">Current Streak</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-gold/10 via-gold/5 to-primary/10 rounded-xl border border-gold/30 shadow-lg">
              <div className="text-3xl font-bold text-gold mb-1">{streakData.longestStreak}</div>
              <div className="text-sm text-muted-foreground">Best Streak</div>
            </div>
          </div>

          {/* Interactive Chart */}
          <div className="space-y-4">
            <h3 className="text-xl font-heading font-semibold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-gold" />
              Progress Over Time
            </h3>
            <div className="bg-gradient-to-br from-muted/10 to-muted/5 rounded-xl p-6 border border-gold/20">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {monthlyData.slice(-7).map((day, index) => (
                  <div key={index} className="text-center">
                    <div className="text-xs text-muted-foreground mb-2">{day.date}</div>
                    <div className="relative">
                      <div className="w-full h-16 bg-muted/20 rounded-lg overflow-hidden">
                        <div 
                          className="w-full bg-gradient-to-t from-gold to-emerald rounded-lg transition-all duration-500"
                          style={{ height: `${Math.max(day.count * 20, 8)}%` }}
                        />
                      </div>
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-gold/90 text-rich-black text-xs px-2 py-1 rounded font-semibold">
                        {day.count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-4">
            <h3 className="text-xl font-heading font-semibold flex items-center gap-2">
              <Target className="h-6 w-6 text-gold" />
              Category Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryData.map(({ category, count, percentage }) => (
                <div key={category} className="p-4 bg-gradient-to-br from-muted/10 to-muted/5 rounded-xl border border-gold/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-gradient-to-br from-gold to-emerald rounded-full shadow-lg"></div>
                      <span className="font-semibold">{category}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gold">{count}</div>
                      <div className="text-xs text-muted-foreground">{percentage}%</div>
                    </div>
                  </div>
                  <div className="w-full bg-muted/20 rounded-full h-2">
                    <div 
                      className="h-2 bg-gradient-to-r from-gold to-emerald rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Motivational Insights */}
          <div className="space-y-4">
            <h3 className="text-xl font-heading font-semibold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-gold" />
              Growth Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-gradient-to-br from-emerald/10 via-emerald/5 to-gold/10 border border-emerald/30 rounded-xl shadow-lg">
                <p className="text-emerald font-semibold mb-2">Most Active Category</p>
                <p className="text-muted-foreground">
                  {categoryData.length > 0 
                    ? `${categoryData[0].category} with ${categoryData[0].count} fortunes`
                    : 'Start tracking to see insights'
                  }
                </p>
              </div>
              {streakData.longestStreak > 3 && (
                <div className="p-6 bg-gradient-to-br from-gold/10 via-gold/5 to-emerald/10 border border-gold/30 rounded-xl shadow-lg">
                  <p className="text-gold font-semibold mb-2">Consistency Champion</p>
                  <p className="text-muted-foreground">
                    Your longest streak is {streakData.longestStreak} days! Keep it up!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Motivational Caption */}
          <div className="text-center py-6">
            <div className="inline-block p-6 bg-gradient-to-r from-gold/10 via-emerald/10 to-gold/10 rounded-xl border border-gold/30 shadow-lg">
              <p className="text-lg font-heading font-semibold text-foreground mb-2">
                {filteredFortunes.length > 0 
                  ? "You're growing. Keep it up." 
                  : "Your journey begins with a single step."
                }
              </p>
              <p className="text-sm text-muted-foreground">
                Every fortune logged is a step toward your dreams
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};