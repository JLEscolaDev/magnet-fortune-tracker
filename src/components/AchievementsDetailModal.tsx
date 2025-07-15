import React from 'react';
import { X, Trophy, Target, Star, Lock } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Achievement } from '@/types/fortune';

interface AchievementsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: Achievement[];
}

export const AchievementsDetailModal = ({ isOpen, onClose, achievements }: AchievementsDetailModalProps) => {
  const earnedAchievements = achievements.filter(a => a.state === 'earned');
  const lockedAchievements = achievements.filter(a => a.state === 'locked');
  
  const getProgressPercentage = (achievement: Achievement) => {
    if (!achievement.progress) return 0;
    return Math.min((achievement.progress / achievement.requiredCount) * 100, 100);
  };

  const getMotivationalMessage = () => {
    const totalEarned = earnedAchievements.length;
    const totalAchievements = achievements.length;
    const percentage = (totalEarned / totalAchievements) * 100;
    
    if (percentage === 100) return "🏆 Master Fortune Seeker! You've unlocked everything!";
    if (percentage >= 75) return "🌟 Almost there! Just a few more to go!";
    if (percentage >= 50) return "🚀 Great progress! Keep tracking those fortunes!";
    if (percentage >= 25) return "💪 Good start! More achievements await!";
    return "🎯 Begin your journey to unlock amazing achievements!";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-background/95 backdrop-blur-md border border-gold/20">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="text-xl font-heading font-semibold text-foreground">Achievement Gallery</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Progress Overview */}
          <div className="text-center p-6 bg-gradient-to-br from-gold/10 to-emerald/10 rounded-xl border border-gold/20">
            <div className="text-3xl mb-2">{earnedAchievements.length}/{achievements.length}</div>
            <div className="text-lg font-semibold text-gold mb-2">Achievements Unlocked</div>
            <div className="w-full bg-muted/30 rounded-full h-3 mb-3">
              <div 
                className="bg-gradient-to-r from-gold to-emerald h-3 rounded-full transition-all duration-1000"
                style={{ width: `${(earnedAchievements.length / achievements.length) * 100}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{getMotivationalMessage()}</p>
          </div>

          {/* Earned Achievements */}
          {earnedAchievements.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-gold" />
                Earned Achievements ({earnedAchievements.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {earnedAchievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="relative p-6 rounded-xl bg-gradient-to-br from-gold/20 to-emerald/20 border border-gold/30 shadow-lg shadow-gold/10"
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl relative">
                        <span className="filter drop-shadow-lg">{achievement.icon}</span>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald rounded-full flex items-center justify-center">
                          <Trophy size={12} className="text-white" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-heading font-semibold text-gold mb-1">
                          {achievement.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {achievement.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-emerald">
                          <Star className="h-3 w-3" />
                          <span>Completed!</span>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-emerald/5 rounded-xl animate-pulse pointer-events-none" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Locked Achievements */}
          {lockedAchievements.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-muted-foreground" />
                In Progress ({lockedAchievements.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lockedAchievements.map((achievement) => {
                  const progressPercentage = getProgressPercentage(achievement);
                  return (
                    <div
                      key={achievement.id}
                      className="relative p-6 rounded-xl bg-muted/10 border border-muted/30 hover:border-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl relative opacity-50">
                          <Lock size={32} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-heading font-semibold text-muted-foreground mb-1">
                            {achievement.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            {achievement.description}
                          </p>
                          
                          {achievement.requiredCount > 1 && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  Progress: {achievement.progress || 0}/{achievement.requiredCount}
                                </span>
                                <span className="text-muted-foreground">
                                  {progressPercentage.toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-muted/30 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-emerald to-gold h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${progressPercentage}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Achievement Tips */}
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <h4 className="font-semibold text-primary mb-2">💡 Achievement Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Track fortunes daily to unlock streak-based achievements</li>
              <li>• Focus on different categories to earn specialized badges</li>
              <li>• The more detailed your fortunes, the better your insights</li>
              <li>• Share your progress with friends for motivation!</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};