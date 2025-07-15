import { useState, useEffect } from 'react';
import { User, Trophy, Crown } from '@phosphor-icons/react';
import { Profile } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

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

  const fortunesPerLevel = 5;
  const currentLevel = Math.floor(fortuneCount / fortunesPerLevel) + 1;
  const progressInCurrentLevel = fortuneCount % fortunesPerLevel;
  const progressPercentage = (progressInCurrentLevel / fortunesPerLevel) * 100;

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const { data: avatarData } = await supabase
          .from('avatars')
          .select('*')
          .eq('level', currentLevel)
          .single();

        if (avatarData) {
          setAvatar(avatarData);
        }

        // Check if user leveled up
        if (profile.level && profile.level < currentLevel) {
          setIsLevelingUp(true);
          
          // Update user's level and avatar_url in profile
          await supabase
            .from('profiles')
            .update({ 
              level: currentLevel, 
              avatar_url: avatarData?.url || null 
            })
            .eq('user_id', profile.user_id);

          onLevelUp?.();
          
          // Reset level up animation after 2 seconds
          setTimeout(() => setIsLevelingUp(false), 2000);
        }
      } catch (error) {
        console.error('Error fetching avatar:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvatar();
  }, [currentLevel, profile.level, profile.user_id, onLevelUp]);

  if (loading) {
    return (
      <div className="luxury-avatar-section">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-muted/30 animate-pulse" />
          <div className="h-4 bg-muted/30 rounded w-32 animate-pulse" />
          <div className="h-2 bg-muted/30 rounded w-48 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="luxury-avatar-section">
      <div className="flex flex-col items-center space-y-4">
        {/* Avatar Circle */}
        <div className="relative">
          <div className={`
            relative w-24 h-24 rounded-full overflow-hidden
            border-2 border-emerald/30
            shadow-[0_0_20px_hsl(var(--emerald)/0.3)]
            transition-all duration-500 ease-out
            ${isLevelingUp ? 'animate-pulse' : ''}
          `}>
            {/* Gold ring that pulses on level up */}
            <div className={`
              absolute inset-0 rounded-full
              border-2 border-gold/60
              transition-all duration-1000 ease-out
              ${isLevelingUp ? 'animate-[pulse_1s_ease-in-out_2] scale-110' : 'scale-100'}
            `} />
            
            {/* Avatar Image */}
            <div className="relative w-full h-full">
              {avatar?.url ? (
                <img
                  src={avatar.url}
                  alt={avatar.title || 'Avatar'}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald to-gold flex items-center justify-center rounded-full">
                  <Crown size={28} weight="fill" className="text-ivory" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Avatar Title */}
        <div className="text-center">
          <h3 className="font-heading text-lg font-semibold text-primary mb-1">
            {avatar?.title || 'Fortune Seeker'}
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Trophy size={14} className="text-gold" />
            Level {currentLevel}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progressInCurrentLevel} / {fortunesPerLevel}</span>
            <span>Next Level</span>
          </div>
          <div className="relative">
            <Progress 
              value={progressPercentage} 
              className="h-2 bg-muted/30 rounded-full overflow-hidden shadow-inner"
            />
            <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]" />
          </div>
        </div>

        {/* Level Up Notification */}
        {isLevelingUp && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="
              bg-gold/90 text-rich-black px-4 py-2 rounded-full
              font-heading font-semibold text-sm
              animate-[scale-in_0.5s_ease-out] shadow-lg
            ">
              Level Up! 🎉
            </div>
          </div>
        )}
      </div>
    </div>
  );
};