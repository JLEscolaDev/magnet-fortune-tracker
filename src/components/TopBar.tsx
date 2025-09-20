import { Gear } from '@phosphor-icons/react';
import { FortuneIcon } from './FortuneIcon';
import { useTutorial } from '@/contexts/TutorialContext';
import { NotificationDot } from './NotificationDot';

interface TopBarProps {
  onSettingsClick: () => void;
}

export const TopBar = ({ onSettingsClick }: TopBarProps) => {
  const { isStepCompleted } = useTutorial();

  const handleSettingsClick = () => {
    onSettingsClick();
  };

  return (
    <header
      className="flex items-center justify-between p-4 border-b border-gold/30 sticky top-0 z-50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <div className="flex items-center gap-3">
        <FortuneIcon />
        <h1 className="text-xl font-heading font-semibold gold-accent">
          Fortune Magnet
        </h1>
      </div>
      
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Settings button clicked');
          handleSettingsClick();
        }}
        className="relative p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-gold/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
        aria-label="Settings"
        type="button"
      >
        <div className="relative">
          <Gear size={24} className="text-foreground hover:text-gold transition-colors" />
          <NotificationDot 
            show={!isStepCompleted('settings')} 
            className="top-0 right-0 -mt-1 -mr-1"
          />
        </div>
      </button>
    </header>
  );
};