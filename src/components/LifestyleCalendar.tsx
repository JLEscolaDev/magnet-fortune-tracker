import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

interface LifestyleEntry {
  id: string;
  date: string;
  mood: string | null;
  created_at: string;
}

interface LifestyleCalendarProps {
  entries: LifestyleEntry[];
  onDateClick: (date: Date) => void;
  selectedDate?: Date | null;
}

export const LifestyleCalendar = ({ entries, onDateClick, selectedDate }: LifestyleCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Add empty cells for days before month starts
  const startDayOfWeek = getDay(monthStart);
  const emptyCells = Array(startDayOfWeek).fill(null);
  
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  const getEntryForDate = (date: Date) => {
    const dayKey = format(date, 'yyyy-MM-dd');
    return entries.find(entry => entry.date === dayKey);
  };

  const getMoodColor = (mood: string | null) => {
    switch (mood) {
      case 'very_good': return 'bg-green-500/20 ring-green-500/40';
      case 'good': return 'bg-green-400/20 ring-green-400/40';
      case 'neutral': return 'bg-yellow-500/20 ring-yellow-500/40';
      case 'bad': return 'bg-orange-500/20 ring-orange-500/40';
      case 'very_bad': return 'bg-red-500/20 ring-red-500/40';
      default: return 'bg-muted/20 ring-muted/40';
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const handleDateClick = (date: Date) => {
    onDateClick(date);
  };

  return (
    <Card className="p-4 bg-background/50 backdrop-blur-sm border-border/50">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth('prev')}
          className="h-8 w-8 p-0 hover:bg-primary/10 transition-all duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h3 className="text-lg font-semibold text-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth('next')}
          className="h-8 w-8 p-0 hover:bg-primary/10 transition-all duration-200"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day Headers */}
        {dayNames.map((day) => (
          <div
            key={day}
            className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground border-b border-border/30 mb-1"
          >
            {day}
          </div>
        ))}

        {/* Empty cells for padding */}
        {emptyCells.map((_, index) => (
          <div key={`empty-${index}`} className="h-10" />
        ))}

        {/* Calendar Days */}
        {calendarDays.map((date) => {
          const entry = getEntryForDate(date);
          const hasEntry = !!entry;
          const isToday = isSameDay(date, new Date());
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          
          return (
            <button
              key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
              onClick={() => handleDateClick(date)}
              className={`
                relative h-10 w-full flex items-center justify-center text-xs font-medium
                rounded-lg transition-all duration-200 hover:scale-105
                ${isSelected && !isToday
                  ? 'bg-primary/20 text-primary border-2 border-primary/40 shadow-md font-bold'
                  : isToday 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:bg-primary/10 text-foreground'
                }
                ${!isSameMonth(date, currentDate) 
                  ? 'text-muted-foreground opacity-50' 
                  : ''
                }
                ${hasEntry 
                  ? `ring-2 ${getMoodColor(entry.mood)}` 
                  : ''
                }
              `}
            >
              <span className="relative z-10 leading-none">
                {format(date, 'd')}
              </span>
              
              {/* Mood indicator */}
              {hasEntry && (
                <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-current opacity-60" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-border/30">
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Great</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span>Okay</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span>Tough</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
