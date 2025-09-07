import { House, ChartLine, Plus } from '@phosphor-icons/react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTutorial } from '@/contexts/TutorialContext';
import { NotificationDot } from './NotificationDot';

interface DesktopTabsProps {
  activeTab: 'home' | 'insights' | 'friends';
  onTabChange: (tab: 'home' | 'insights' | 'friends') => void;
  onAddFortuneClick: () => void;
  selectedDate?: Date | null;
}

export const DesktopTabs = ({ activeTab, onTabChange, onAddFortuneClick, selectedDate }: DesktopTabsProps) => {
  const { isStepCompleted, showTutorial } = useTutorial();

  const handleTabChange = (tab: 'home' | 'insights' | 'friends') => {
    onTabChange(tab);
    
    if (!isStepCompleted(tab)) {
      showTutorial(tab);
    }
  };

  const handleAddFortuneClick = () => {
    onAddFortuneClick();
    
    if (!isStepCompleted('create-fortune')) {
      showTutorial('create-fortune');
    }
  };

  return (
    <div className="hidden md:flex items-center justify-between border-b border-gold/30 px-6 py-4">
      <div className="flex space-x-1">
        <button
          onClick={() => handleTabChange('home')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg transition-all relative
            ${activeTab === 'home'
              ? 'text-emerald bg-emerald/10 border-b-2 border-emerald'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }
          `}
        >
          <House size={20} weight={activeTab === 'home' ? 'fill' : 'regular'} />
          <span className="font-medium">Home</span>
          <NotificationDot 
            show={!isStepCompleted('home')} 
            className="top-1 right-1"
          />
        </button>
        
        <button
          onClick={() => handleTabChange('insights')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg transition-all relative
            ${activeTab === 'insights'
              ? 'text-emerald bg-emerald/10 border-b-2 border-emerald'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }
          `}
        >
          <ChartLine size={20} weight={activeTab === 'insights' ? 'fill' : 'regular'} />
          <span className="font-medium">Insights</span>
          <NotificationDot 
            show={!isStepCompleted('insights')} 
            className="top-1 right-1"
          />
        </button>

        <button
          onClick={() => handleTabChange('friends')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg transition-all relative
            ${activeTab === 'friends'
              ? 'text-emerald bg-emerald/10 border-b-2 border-emerald'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }
          `}
        >
          <Users size={20} />
          <span className="font-medium">Friends</span>
          <NotificationDot 
            show={!isStepCompleted('friends')} 
            className="top-1 right-1"
          />
        </button>
      </div>

      <Button 
        onClick={handleAddFortuneClick} 
        className="luxury-button relative"
      >
        <Plus size={18} className="mr-2" />
        Track Fortune
        <NotificationDot 
          show={!isStepCompleted('create-fortune')} 
          className="top-0 right-0 -mt-2 -mr-2"
          size="md"
        />
      </Button>
    </div>
  );
};