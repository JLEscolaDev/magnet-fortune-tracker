import { useState, useEffect } from 'react';
import { HeroCard } from './HeroCard';
import { FortuneList } from './FortuneList';
import { Fortune, Profile } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';

interface HomeTabProps {
  refreshTrigger: number;
}

export const HomeTab = ({ refreshTrigger }: HomeTabProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todaysFortunes, setTodaysFortunes] = useState<Fortune[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Fetch or create profile
      let { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profileData) {
        // Create profile if it doesn't exist
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert([{ 
            user_id: user.id, 
            display_name: user.email?.split('@')[0] || 'Fortune Seeker'
          }])
          .select()
          .single();
        
        profileData = newProfile;
      }

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch today's fortunes
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      const { data: fortunesData } = await supabase
        .from('fortunes')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startOfToday.toISOString())
        .lte('created_at', endOfToday.toISOString())
        .order('created_at', { ascending: false });

      if (fortunesData) {
        setTodaysFortunes(fortunesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  if (loading) {
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

  return (
    <div className="space-y-6 p-6 pb-24 md:pb-6">
      <HeroCard 
        profile={profile} 
        recentAchievements={[]} // TODO: Implement achievements logic
      />
      <FortuneList fortunes={todaysFortunes} />
    </div>
  );
};