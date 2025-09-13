import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Edit } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { KnowMyselfWizard } from './knowmyself/KnowMyselfWizard';
import { LifestyleCalendar } from './LifestyleCalendar';
import { KnowMyselfModal } from './modals/KnowMyselfModal';

interface LifestyleEntry {
  id: string;
  date: string;
  mood: string | null;
  created_at: string;
}

export const LifestyleTrackerTab = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<LifestyleEntry[]>([]);
  const [todayEntry, setTodayEntry] = useState<LifestyleEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    // Check if today has an entry
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayData = entries.find(entry => entry.date === today);
    setTodayEntry(todayData || null);
  }, [entries]);

  const loadEntries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('lifestyle_entries')
        .select('id, date, mood, created_at')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => 
      direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1)
    );
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    loadEntries(); // Refresh entries after modal closes
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-4 p-6 pb-24 md:pb-6">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-medium flex items-center gap-2">
          <Calendar className="text-gold" size={24} />
          Know Myself
        </h3>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate('prev')}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium min-w-[120px] text-center">
            {format(selectedDate, 'MMM d, yyyy')}
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate('next')}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Show Calendar or Wizard based on today's entry */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : todayEntry && isToday ? (
        <>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              You've already tracked today! View your entries below or tap a day to edit.
            </p>
            <Button
              onClick={() => setShowModal(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Today's Entry
            </Button>
          </div>
          <LifestyleCalendar
            entries={entries}
            onDateClick={handleDateClick}
            selectedDate={selectedDate}
          />
        </>
      ) : (
        <KnowMyselfWizard selectedDate={selectedDate} />
      )}

      {/* Modal for editing entries */}
      <KnowMyselfModal 
        open={showModal} 
        onOpenChange={setShowModal}
      />
    </div>
  );
};