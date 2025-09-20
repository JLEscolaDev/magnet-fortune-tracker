import { House, ChartLine } from '@phosphor-icons/react';
import { Users } from 'lucide-react';
import { useTutorial } from '@/contexts/TutorialContext';
import { NotificationDot } from './NotificationDot';

interface TabBarProps {
  activeTab: 'home' | 'insights' | 'friends';
  onTabChange: (tab: 'home' | 'insights' | 'friends') => void;
}

export const TabBar = ({ activeTab, onTabChange }: TabBarProps) => {
  const { isStepCompleted, showTutorial, markStepCompleted } = useTutorial();

  const handleTabChange = (tab: 'home' | 'insights' | 'friends') => {
    onTabChange(tab);
    
    // Show tutorial if not completed, otherwise just mark as completed
    if (!isStepCompleted(tab)) {
      showTutorial(tab);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 md:hidden bg-card border-t border-gold/30 z-50"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        ['--bottom-nav-height' as any]: '56px'
      }}
    >
      <div className="grid grid-cols-3">
        <button
          onClick={() => handleTabChange('home')}
          className={`
            relative flex flex-col items-center gap-1 py-3 px-4 transition-colors
            ${activeTab === 'home' 
              ? 'text-emerald bg-emerald/10' 
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <div className="relative">
            <House size={24} weight={activeTab === 'home' ? 'fill' : 'regular'} />
            <NotificationDot 
              show={!isStepCompleted('home')} 
              className="top-0 right-0 -mt-1 -mr-1"
            />
          </div>
          <span className="text-xs font-medium">Home</span>
        </button>
        
        <button
          onClick={() => handleTabChange('insights')}
          className={`
            relative flex flex-col items-center gap-1 py-3 px-4 transition-colors
            ${activeTab === 'insights' 
              ? 'text-emerald bg-emerald/10' 
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <div className="relative">
            <ChartLine size={24} weight={activeTab === 'insights' ? 'fill' : 'regular'} />
            <NotificationDot 
              show={!isStepCompleted('insights')} 
              className="top-0 right-0 -mt-1 -mr-1"
            />
          </div>
          <span className="text-xs font-medium">Insights</span>
        </button>

        <button
          onClick={() => handleTabChange('friends')}
          className={`
            relative flex flex-col items-center gap-1 py-3 px-4 transition-colors
            ${activeTab === 'friends' 
              ? 'text-emerald bg-emerald/10' 
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <div className="relative">
            <Users size={24} />
            <NotificationDot 
              show={!isStepCompleted('friends')} 
              className="top-0 right-0 -mt-1 -mr-1"
            />
          </div>
          <span className="text-xs font-medium">Friends</span>
        </button>
      </div>
    </div>
  );
};