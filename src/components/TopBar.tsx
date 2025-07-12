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
        onClick={onSettingsClick}
        className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
        aria-label="Settings"
      >
        <Gear size={24} className="text-foreground" />
      </button>
    </header>
  );
};