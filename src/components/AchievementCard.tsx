import { Achievement } from '@/types/fortune';
import { Lock, Trophy } from '@phosphor-icons/react';

interface AchievementCardProps {
  achievement: Achievement;
  isEarned: boolean;
  progress?: number;
}

export const AchievementCard = ({ achievement, isEarned, progress = 0 }: AchievementCardProps) => {
  const progressPercentage = Math.min((progress / achievement.requiredCount) * 100, 100);

  return (
    <div
      className={`
        relative p-4 rounded-lg text-center transition-all duration-300 transform hover:scale-105
        ${isEarned 
          ? 'bg-gradient-to-br from-gold/20 to-emerald/20 border border-gold/30 shadow-lg shadow-gold/20' 
          : 'bg-muted/20 border border-muted/30 hover:border-muted/50'
        }
      `}
    >
      {/* Achievement Icon */}
      <div className="text-3xl mb-3 relative">
        {isEarned ? (
          <div className="relative">
            <span className="filter drop-shadow-lg">{achievement.icon}</span>
            {isEarned && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald rounded-full flex items-center justify-center">
                <Trophy size={12} className="text-ivory" />
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <Lock size={32} className="mx-auto text-muted-foreground opacity-50" />
          </div>
        )}
      </div>

      {/* Achievement Info */}
      <h4 className={`font-heading font-medium text-sm mb-2 ${isEarned ? 'text-gold' : 'text-muted-foreground'}`}>
        {achievement.title}
      </h4>
      <p className="text-xs text-muted-foreground mb-3">
        {achievement.description}
      </p>

      {/* Progress Bar */}
      {!isEarned && achievement.requiredCount > 1 && (
        <div className="space-y-1">
          <div className="w-full bg-muted/30 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-emerald to-gold h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress}/{achievement.requiredCount}
          </p>
        </div>
      )}

      {/* Earned Glow Effect */}
      {isEarned && (
        <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-emerald/10 rounded-lg animate-pulse pointer-events-none" />
      )}
    </div>
  );
};