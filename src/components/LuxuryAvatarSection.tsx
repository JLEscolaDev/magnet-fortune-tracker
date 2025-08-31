import { useState, useEffect } from 'react';
import { Trophy, Crown } from '@phosphor-icons/react';
import { Profile } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { useSettings } from '@/contexts/SettingsContext';
import betaTesterBadge from '@/assets/beta-tester-badge.webp';

interface Avatar {
  id: string;
  level: number;
  url: string;
  title: string | null;
}

interface LuxuryAvatarSectionProps {
  profile: Profile;
  fortuneCount: number;
  onLevelUp?: () => void;
}

export const LuxuryAvatarSection = ({ profile, fortuneCount, onLevelUp }: LuxuryAvatarSectionProps) => {
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBetaTester, setIsBetaTester] = useState(false);
  const { animationsEnabled } = useSettings();

  const fortunesPerLevel = 5;
  const currentLevel = Math.floor(fortuneCount / fortunesPerLevel) + 1;
  const progressInCurrentLevel = fortuneCount % fortunesPerLevel;
  const progressPercentage = (progressInCurrentLevel / fortunesPerLevel) * 100;

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const { data: avatarData, error } = await supabase
          .from('avatars')
          .select('*')
          .eq('level', currentLevel)
          .maybeSingle();

        if (error) {
          console.error('Error fetching avatar:', error);
        }

        if (avatarData) {
          setAvatar(avatarData);
        }

        // Check if user leveled up
        if ((profile.level || 1) < currentLevel) {
          if (animationsEnabled) {
            setIsLevelingUp(true);
          }
          
          // Update user's level and avatar_url in profile
          await supabase
            .from('profiles')
            .update({ 
              level: currentLevel, 
              avatar_url: avatarData?.url || null 
            })
            .eq('user_id', profile.user_id);

          onLevelUp?.();
          
          // Reset level up animation after 3 seconds (only if animations are enabled)
          if (animationsEnabled) {
            setTimeout(() => setIsLevelingUp(false), 3000);
          }
        }
      } catch (error) {
        console.error('Error fetching avatar:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvatar();
  }, [currentLevel, profile.level, profile.user_id, onLevelUp]);

  // Check if user is a beta tester (registered before 2026)
  useEffect(() => {
    const checkBetaTesterStatus = async () => {
      try {
        const registrationDate = new Date(profile.created_at);
        const cutoffDate = new Date('2026-01-01T00:00:00.000Z');
        setIsBetaTester(registrationDate < cutoffDate);
      } catch (error) {
        console.error('Error checking beta tester status:', error);
      }
    };

    if (profile?.created_at) {
      checkBetaTesterStatus();
    }
  }, [profile?.created_at]);

  if (loading) {
    return (
      <div className="relative w-full aspect-square rounded-2xl bg-muted/30 animate-pulse overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <div className="h-4 bg-muted/50 rounded w-32" />
          <div className="h-3 bg-muted/50 rounded w-24" />
          <div className="h-2 bg-muted/50 rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[50vh] aspect-[5/4] mx-auto rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
      {/* Background Avatar Image */}
      <div className="absolute inset-0">
        {avatar?.url ? (
          <img
            src={avatar.url}
            alt={avatar.title || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald via-emerald/80 to-gold flex items-center justify-center">
            <Crown size={64} weight="fill" className="text-ivory opacity-80" />
          </div>
        )}
      </div>

      {/* Gold ring that pulses on level up */}
      <div className={`
        absolute inset-0 rounded-2xl
        border-2 border-gold/40
        transition-all duration-1000 ease-out
        ${isLevelingUp ? 'animate-[pulse_1s_ease-in-out_2] scale-[1.02] border-gold/80' : ''}
      `} />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
        {/* Avatar Title */}
        <h3 className="font-heading text-xl font-semibold text-white mb-2 drop-shadow-lg">
          {avatar?.title || 'Fortune Seeker'}
        </h3>
        
        {/* Level with Trophy */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Trophy size={16} className="text-gold drop-shadow-lg" />
          <span className="text-gold font-semibold text-sm drop-shadow-lg">Level {currentLevel}</span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-white/80">
            <span>{progressInCurrentLevel} / {fortunesPerLevel}</span>
            <span>Next Level</span>
          </div>
          <div className="relative">
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-gold to-emerald rounded-full transition-all duration-500 ease-out shadow-lg"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="absolute inset-0 rounded-full shadow-[0_0_8px_hsl(var(--gold)/0.5)]" />
          </div>
        </div>
      </div>

      {/* Level Up Notification */}
      {isLevelingUp && animationsEnabled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gold/95 text-rich-black px-6 py-3 rounded-full font-heading font-semibold text-lg animate-[scale-in_0.5s_ease-out] shadow-xl border-2 border-gold">
            Level Up! 🎉
          </div>
        </div>
      )}

      {/* Beta Tester Badge */}
      {isBetaTester && (
        <div className="absolute top-3 right-3 w-12 h-12">
          <img 
            src={betaTesterBadge} 
            alt="Beta Tester Badge" 
            className="w-full h-full object-contain drop-shadow-lg"
          />
        </div>
      )}
    </div>
  );
};