import { useState, useEffect } from 'react';
import { LuxuryAvatarSection } from './LuxuryAvatarSection';
import { FortuneList } from './FortuneList';
import { Fortune } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { useAppState } from '@/contexts/AppStateContext';

interface HomeTabProps {
  refreshTrigger: number;
}

export const HomeTab = ({ refreshTrigger }: HomeTabProps) => {
  const { profile, fortunesCountTotal, loading: appLoading } = useAppState();
  const [recentFortunes, setRecentFortunes] = useState<Fortune[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentFortunes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      console.log('[QUERY:fortunes] Fetching recent fortunes');

      // Fetch recent fortunes (last 20) instead of just today's
      const { data: fortunesData, error } = await supabase
        .from('fortunes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.warn(`[QUERY:fortunes] Error fetching recent fortunes: ${error.message}`);
      } else if (fortunesData) {
        setRecentFortunes(fortunesData);
        console.log(`[QUERY:fortunes] Fetched ${fortunesData.length} recent fortunes`);
      }
    } catch (error) {
      console.error('[QUERY:fortunes] Error in fetchRecentFortunes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentFortunes();
  }, [refreshTrigger]);

  if (loading || appLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="luxury-card p-6 animate-pulse">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-24 h-24 rounded-full bg-muted/30" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted/30 rounded w-20" />
              <div className="h-5 bg-muted/30 rounded w-48" />
              <div className="h-3 bg-muted/30 rounded w-32" />
            </div>
          </div>
        </div>
        <div className="luxury-card p-6 animate-pulse">
          <div className="h-6 bg-muted/30 rounded w-40 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/20 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <div className="luxury-card p-6 text-center">
          <p className="text-muted-foreground">
            Setting up your profile...
          </p>
        </div>
      </div>
    );
  }

  const handleLevelUp = () => {
    // Refetch recent fortunes
    fetchRecentFortunes();
  };

  return (
    <div className="space-y-6 p-6 pb-24 md:pb-6">
      <LuxuryAvatarSection 
        profile={profile} 
        fortuneCount={fortunesCountTotal}
        onLevelUp={handleLevelUp}
      />
      <FortuneList 
        fortunes={recentFortunes} 
        title="Recent Fortunes"
        onFortunesUpdated={fetchRecentFortunes}
      />
    </div>
  );
};