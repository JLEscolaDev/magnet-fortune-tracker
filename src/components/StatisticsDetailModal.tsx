import React from 'react';
import { X, TrendingUp, Calendar, Target } from 'lucide-react';
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-background/95 backdrop-blur-md border border-gold/20">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="text-xl font-heading font-semibold text-foreground">Detailed Statistics</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-gold/10 to-emerald/10 rounded-lg border border-gold/20">
              <div className="text-2xl font-bold text-gold">{fortunes.length}</div>
              <div className="text-sm text-muted-foreground">Total Fortunes</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-emerald/10 to-gold/10 rounded-lg border border-emerald/20">
              <div className="text-2xl font-bold text-emerald">
                {new Set(fortunes.map(f => new Date(f.created_at).toDateString())).size}
              </div>
              <div className="text-sm text-muted-foreground">Active Days</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-gold/10 rounded-lg border border-primary/20">
              <div className="text-2xl font-bold text-primary">{streakData.currentStreak}</div>
              <div className="text-sm text-muted-foreground">Current Streak</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-gold/10 to-primary/10 rounded-lg border border-gold/20">
              <div className="text-2xl font-bold text-gold">{streakData.longestStreak}</div>
              <div className="text-sm text-muted-foreground">Best Streak</div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-gold" />
              Category Breakdown
            </h3>
            <div className="space-y-3">
              {categoryData.map(({ category, count, percentage }) => (
                <div key={category} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-gold rounded-full"></div>
                    <span className="font-medium">{category}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{count}</div>
                    <div className="text-xs text-muted-foreground">{percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Activity */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gold" />
              This Month's Activity
            </h3>
            <div className="grid grid-cols-7 gap-2">
              {monthlyData.slice(-7).map((day, index) => (
                <div key={index} className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">{day.date}</div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                    day.count > 0 
                      ? 'bg-gold/20 text-gold border border-gold/30' 
                      : 'bg-muted/20 text-muted-foreground'
                  }`}>
                    {day.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gold" />
              Insights
            </h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-emerald/10 border border-emerald/20 rounded-lg">
                <p className="text-emerald font-medium">Most Active Category</p>
                <p className="text-muted-foreground">
                  {categoryData.length > 0 
                    ? `${categoryData[0].category} with ${categoryData[0].count} fortunes`
                    : 'Start tracking to see insights'
                  }
                </p>
              </div>
              {streakData.longestStreak > 3 && (
                <div className="p-3 bg-gold/10 border border-gold/20 rounded-lg">
                  <p className="text-gold font-medium">Consistency Achievement</p>
                  <p className="text-muted-foreground">
                    Your longest streak is {streakData.longestStreak} days! Keep it up!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};