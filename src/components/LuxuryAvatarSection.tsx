import { useState, useEffect, useRef } from 'react';
import { Trophy, Crown } from '@phosphor-icons/react';
import { Profile } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { useSettings } from '@/contexts/SettingsContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { KnowMyselfModal } from './modals/KnowMyselfModal';
import { useAvatar } from '@/hooks/useAvatar';
import { toast } from 'sonner';
import betaTesterBadge from '@/assets/beta-tester-badge.webp';

interface LuxuryAvatarSectionProps {
  profile: Profile;
  fortuneCount: number;
  onLevelUp?: () => void;
  onOpenPricing?: () => void;
}

// Module-level guard to prevent level update loops across component remounts
const levelUpdateState = {
  inProgress: false,
  lastUpdatedLevel: 0,
  lastUpdatedUserId: null as string | null,
};

export const LuxuryAvatarSection = ({ profile, fortuneCount, onLevelUp, onOpenPricing }: LuxuryAvatarSectionProps) => {
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [isBetaTester, setIsBetaTester] = useState(false);
  const [showKnowMyselfModal, setShowKnowMyselfModal] = useState(false);
  const { animationsEnabled } = useSettings();
  const { hasActiveSub } = useSubscription();

  const fortunesPerLevel = 5;
  const currentLevel = Math.floor(fortuneCount / fortunesPerLevel) + 1;
  const progressInCurrentLevel = fortuneCount % fortunesPerLevel;
  const progressPercentage = (progressInCurrentLevel / fortunesPerLevel) * 100;

  // Use shared avatar hook with cache
  const { avatar, loading } = useAvatar(currentLevel);

  // Check if user leveled up and update profile
  // Stable ref for onLevelUp callback to prevent dependency loop
  const onLevelUpRef = useRef(onLevelUp);
  onLevelUpRef.current = onLevelUp;
  
  useEffect(() => {
    if (!avatar || !profile?.user_id) return;
    
    const currentProfileLevel = profile.level || 1;
    
    // Module-level guard to prevent loops across remounts
    // Skip if already processing, or if we've already updated to this level for this user
    const alreadyUpdatedThisLevel = 
      levelUpdateState.lastUpdatedUserId === profile.user_id && 
      levelUpdateState.lastUpdatedLevel >= currentLevel;
    
    if (currentProfileLevel < currentLevel && !levelUpdateState.inProgress && !alreadyUpdatedThisLevel) {
      levelUpdateState.inProgress = true;
      levelUpdateState.lastUpdatedUserId = profile.user_id;
      levelUpdateState.lastUpdatedLevel = currentLevel;
      
      if (animationsEnabled) {
        setIsLevelingUp(true);
      }
      
      // Update user's level and avatar_url in profile
      const updateProfile = async () => {
        try {
          const result = await supabase
            .from('profiles')
            .update({ 
              level: currentLevel, 
              avatar_url: avatar.url || null 
            })
            .eq('user_id', profile.user_id);
          
          if (result.error) {
            console.error('Error updating profile level:', result.error);
            levelUpdateState.inProgress = false;
          } else {
            // Profile update successful - call stable ref
            onLevelUpRef.current?.();
            // Reset inProgress flag after a delay to allow state to settle
            setTimeout(() => {
              levelUpdateState.inProgress = false;
            }, 2000); // Increased to 2 seconds
          }
        } catch (error) {
          console.error('Error updating profile level:', error);
          levelUpdateState.inProgress = false;
        }
      };
      updateProfile();
      
      // Reset level up animation after 3 seconds (only if animations are enabled)
      if (animationsEnabled) {
        const timeoutId = setTimeout(() => setIsLevelingUp(false), 3000);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [avatar, currentLevel, profile?.level, profile?.user_id, animationsEnabled]);

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

  const handleAvatarClick = () => {
    console.log('[AVATAR] Click handler called', { hasActiveSub });
    // Only show the modal if user has active subscription (tier-based access)
    if (hasActiveSub) {
      console.log('[AVATAR] Opening KnowMyself modal');
      setShowKnowMyselfModal(true);
    } else {
      console.log('[AVATAR] No active subscription, showing upgrade message');
      toast.info('Premium Feature', {
        description: 'Upgrade to Pro or Lifetime to access the daily wellness survey',
        action: {
          label: 'View Plans',
          onClick: () => {
            if (onOpenPricing) {
              onOpenPricing();
            } else {
              // Fallback: navigate to settings page
              window.location.hash = '#settings';
            }
          }
        }
      });
    }
  };

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
    <>
      <div 
        className="relative w-full max-w-[50vh] aspect-[5/4] mx-auto rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
        onClick={handleAvatarClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleAvatarClick();
          }
        }}
        aria-label={hasActiveSub ? "Open daily wellness survey" : "Avatar (Premium feature)"}
      >
      {/* Background Avatar Image */}
      <div className="absolute inset-0 pointer-events-none">
        {avatar?.url ? (
          <img
            src={avatar.url}
            alt={avatar.title || 'Avatar'}
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald via-emerald/80 to-gold flex items-center justify-center pointer-events-none">
            <Crown size={64} weight="fill" className="text-ivory opacity-80" />
          </div>
        )}
      </div>

      {/* Gold ring that pulses on level up */}
      <div className={`
        absolute inset-0 rounded-2xl pointer-events-none
        border-2 border-gold/40
        transition-all duration-1000 ease-out
        ${isLevelingUp ? 'animate-[pulse_1s_ease-in-out_2] scale-[1.02] border-gold/80' : ''}
      `} />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 text-center pointer-events-none">
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
        <div className="absolute top-3 right-3 w-12 h-12 pointer-events-none">
          <img 
            src={betaTesterBadge} 
            alt="Beta Tester Badge" 
            className="w-full h-full object-contain drop-shadow-lg pointer-events-none"
          />
        </div>
        )}
      </div>

      <KnowMyselfModal 
        open={showKnowMyselfModal} 
        onOpenChange={setShowKnowMyselfModal} 
      />
    </>
  );
};