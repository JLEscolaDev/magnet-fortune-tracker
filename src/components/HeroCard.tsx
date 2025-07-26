import { Crown, Trophy } from '@phosphor-icons/react';
import { Profile } from '@/types/fortune';

interface HeroCardProps {
  profile: Profile;
  recentAchievements: string[];
}

export const HeroCard = ({ profile, recentAchievements }: HeroCardProps) => {
  return (
    <div className="luxury-card p-6 mb-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-24 h-24 rounded-full border-2 border-gold/50 p-1">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald to-gold flex items-center justify-center">
            <Crown size={32} weight="fill" className="text-ivory" />
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gold bg-gold/20 px-2 py-1 rounded-full">
              Level {profile.level || 1}
            </span>
          </div>
          <h2 className="text-lg font-heading font-semibold mb-1">
            Welcome back, {profile.display_name || 'Fortune Seeker'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {profile.total_fortunes || 0} fortunes tracked
          </p>
        </div>
      </div>

      {recentAchievements.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gold flex items-center gap-2">
            <Trophy size={16} />
            Recent Achievements
          </h3>
          <div className="flex flex-wrap gap-2">
            {recentAchievements.map((achievement, index) => (
              <span
                key={index}
                className="text-xs bg-emerald/20 text-emerald px-3 py-1 rounded-full border border-emerald/30"
              >
                {achievement}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};