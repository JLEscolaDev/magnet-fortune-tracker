import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Edit } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { KnowMyselfWizard } from './knowmyself/KnowMyselfWizard';
import { LifestyleCalendar } from './LifestyleCalendar';
import { KnowMyselfModal } from './modals/KnowMyselfModal';
import { useAuth } from '@/auth/AuthProvider';

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
  
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadEntries();
    }
  }, [user, loadEntries]);

  // Listen for lifestyle data updates from other components
  useEffect(() => {
    const handleLifestyleUpdate = () => {
      loadEntries();
    };

    window.addEventListener('lifestyleDataUpdated', handleLifestyleUpdate);
    return () => window.removeEventListener('lifestyleDataUpdated', handleLifestyleUpdate);
  }, [user, loadEntries]);

  useEffect(() => {
    // Check if today has an entry
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayData = entries.find(entry => entry.date === today);
    setTodayEntry(todayData || null);
  }, [entries]);

  const loadEntries = useCallback(async () => {
    try {
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
  }, [user]);

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
  const hasTodayEntry = !!todayEntry;


  return (
    <div className="space-y-4 p-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-medium flex items-center gap-2">
          <Calendar className="text-gold" size={24} />
          Know Myself
        </h3>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Show prompt to track today if no entry exists for today */}
          {!hasTodayEntry && isToday && (
            <div className="text-center py-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
              <p className="text-sm text-muted-foreground mb-3">
                How are you feeling today? Track your daily well-being.
              </p>
              <Button
                onClick={() => setShowModal(true)}
                size="sm"
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Track Today
              </Button>
            </div>
          )}

          {/* Calendar - Always show as default */}
          <LifestyleCalendar
            entries={entries}
            onDateClick={handleDateClick}
            selectedDate={selectedDate}
          />
        </>
      )}

      {/* Modal for adding/editing entries */}
      <KnowMyselfModal 
        open={showModal} 
        selectedDate={selectedDate}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) {
            loadEntries(); // Refresh entries when modal closes
          }
        }}
      />
    </div>
  );
};