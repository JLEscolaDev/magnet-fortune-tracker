import { House, ChartLine, Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface DesktopTabsProps {
  activeTab: 'home' | 'insights';
  onTabChange: (tab: 'home' | 'insights') => void;
  onAddFortuneClick: () => void;
  selectedDate?: Date | null;
}

export const DesktopTabs = ({ activeTab, onTabChange, onAddFortuneClick, selectedDate }: DesktopTabsProps) => {
  return (
    <div className="hidden md:flex items-center justify-between border-b border-gold/30 px-6 py-4">
      <div className="flex space-x-1">
        <button
          onClick={() => onTabChange('home')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${activeTab === 'home'
              ? 'text-emerald bg-emerald/10 border-b-2 border-emerald'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }
          `}
        >
          <House size={20} weight={activeTab === 'home' ? 'fill' : 'regular'} />
          <span className="font-medium">Home</span>
        </button>
        
        <button
          onClick={() => onTabChange('insights')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${activeTab === 'insights'
              ? 'text-emerald bg-emerald/10 border-b-2 border-emerald'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }
          `}
        >
          <ChartLine size={20} weight={activeTab === 'insights' ? 'fill' : 'regular'} />
          <span className="font-medium">Insights</span>
        </button>
      </div>

      <Button 
        onClick={onAddFortuneClick} 
        className="luxury-button"
      >
        <Plus size={18} className="mr-2" />
        Track Fortune
      </Button>
    </div>
  );
};