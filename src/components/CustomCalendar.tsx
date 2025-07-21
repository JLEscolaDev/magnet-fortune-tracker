import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

interface Fortune {
  id: string;
  text: string;
  category: string;
  created_at: string;
  fortune_level?: number;
}

interface CustomCalendarProps {
  fortunes: Fortune[];
  onDateClick: (date: Date, fortunes: Fortune[]) => void;
  selectedDate?: Date | null;
  onDateSelect?: (date: Date) => void;
}

export const CustomCalendar = ({ fortunes, onDateClick, selectedDate, onDateSelect }: CustomCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Add empty cells for days before month starts
  const startDayOfWeek = getDay(monthStart);
  const emptyCells = Array(startDayOfWeek).fill(null);
  
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  const getFortunesForDate = (date: Date) => {
    return fortunes.filter(fortune => 
      isSameDay(new Date(fortune.created_at), date)
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const handleDateClick = (date: Date) => {
    const dateFortunes = getFortunesForDate(date);
    
    // If onDateSelect is provided, handle date selection
    if (onDateSelect) {
      onDateSelect(date);
    }
    
    // Always trigger the detail modal
    onDateClick(date, dateFortunes);
  };

  return (
    <Card className="p-6 bg-background/50 backdrop-blur-sm border-border/50 shadow-elegant">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth('prev')}
          className="h-8 w-8 p-0 hover:bg-primary/10 transition-all duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h2 className="text-xl font-semibold text-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        
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
            className="h-10 flex items-center justify-center text-sm font-medium text-muted-foreground border-b border-border/30 mb-2"
          >
            {day}
          </div>
        ))}

        {/* Empty cells for padding */}
        {emptyCells.map((_, index) => (
          <div key={`empty-${index}`} className="h-12" />
        ))}

        {/* Calendar Days */}
        {calendarDays.map((date) => {
          const dateFortunes = getFortunesForDate(date);
          const hasfortunes = dateFortunes.length > 0;
          const isToday = isSameDay(date, new Date());
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => handleDateClick(date)}
              className={`
                relative h-12 w-full flex flex-col items-center justify-center text-sm font-medium
                rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-md
                ${isSelected && !isToday
                  ? 'bg-[hsl(var(--sapphire))] text-ivory shadow-sapphire-glow'
                  : isToday 
                  ? 'bg-primary text-primary-foreground shadow-glow' 
                  : 'hover:bg-primary/10 text-foreground'
                }
                ${!isSameMonth(date, currentDate) 
                  ? 'text-muted-foreground opacity-50' 
                  : ''
                }
                ${hasfortunes 
                  ? 'ring-2 ring-gold/30 bg-gold/5' 
                  : ''
                }
              `}
            >
              <span className="relative z-10 leading-none">
                {format(date, 'd')}
              </span>
              
              {/* Fortune count badge */}
              {hasfortunes && (
                <div className="mt-1 px-1.5 py-0.5 bg-gold/20 border border-gold/40 rounded-full flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
                  {dateFortunes.length > 1 && (
                    <span className="text-xs font-bold text-gold leading-none">
                      {dateFortunes.length}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-border/30">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gold rounded-full shadow-gold-glow" />
            <span>Has fortunes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <span>Today</span>
          </div>
          {selectedDate && !isSameDay(selectedDate, new Date()) && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-[hsl(var(--sapphire))] rounded-full" />
              <span>Selected</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};