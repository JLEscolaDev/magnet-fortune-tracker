import { House, ChartLine } from '@phosphor-icons/react';
import { Users } from 'lucide-react';

interface TabBarProps {
  activeTab: 'home' | 'insights' | 'friends';
  onTabChange: (tab: 'home' | 'insights' | 'friends') => void;
}

export const TabBar = ({ activeTab, onTabChange }: TabBarProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden bg-card border-t border-gold/30 z-30">
      <div className="grid grid-cols-3">
        <button
          onClick={() => onTabChange('home')}
          className={`
            flex flex-col items-center gap-1 py-3 px-4 transition-colors
            ${activeTab === 'home' 
              ? 'text-emerald bg-emerald/10' 
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <House size={24} weight={activeTab === 'home' ? 'fill' : 'regular'} />
          <span className="text-xs font-medium">Home</span>
        </button>
        
        <button
          onClick={() => onTabChange('insights')}
          className={`
            flex flex-col items-center gap-1 py-3 px-4 transition-colors
            ${activeTab === 'insights' 
              ? 'text-emerald bg-emerald/10' 
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <ChartLine size={24} weight={activeTab === 'insights' ? 'fill' : 'regular'} />
          <span className="text-xs font-medium">Insights</span>
        </button>

        <button
          onClick={() => onTabChange('friends')}
          className={`
            flex flex-col items-center gap-1 py-3 px-4 transition-colors
            ${activeTab === 'friends' 
              ? 'text-emerald bg-emerald/10' 
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <Users size={24} />
          <span className="text-xs font-medium">Friends</span>
        </button>
      </div>
    </div>
  );
};