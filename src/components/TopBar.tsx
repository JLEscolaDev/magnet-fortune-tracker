import { Gear } from '@phosphor-icons/react';
import { FortuneIcon } from './FortuneIcon';

interface TopBarProps {
  onSettingsClick: () => void;
}

export const TopBar = ({ onSettingsClick }: TopBarProps) => {
  return (
    <header className="flex items-center justify-between p-4 border-b border-gold/30">
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
          onSettingsClick();
        }}
        className="p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-gold/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
        aria-label="Settings"
        type="button"
      >
        <Gear size={24} className="text-foreground hover:text-gold transition-colors" />
      </button>
    </header>
  );
};