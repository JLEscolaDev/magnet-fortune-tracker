import { Plus, Lock } from '@phosphor-icons/react';
import { isSameDay } from 'date-fns';
import { useFreePlanLimits } from '@/hooks/useFreePlanLimits';

interface FloatingActionButtonProps {
  onClick: () => void;
  selectedDate?: Date | null;
}

export const FloatingActionButton = ({ onClick, selectedDate }: FloatingActionButtonProps) => {
  const freePlanStatus = useFreePlanLimits();

  const handleClick = () => {
    if (!freePlanStatus.canAddFortune) {
      // Could show a toast or modal here explaining the limit
      return;
    }
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={!freePlanStatus.canAddFortune}
      className={`
        fixed bottom-20 right-6 md:hidden
        w-14 h-14 rounded-full
        text-ivory
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:scale-110 active:scale-95
        z-[80]
        ${!freePlanStatus.canAddFortune 
          ? 'bg-muted/50 cursor-not-allowed' 
          : selectedDate && !isSameDay(selectedDate, new Date())
            ? 'bg-gradient-to-r from-[hsl(var(--mint))] to-[hsl(var(--mint-border))] shadow-lg shadow-[hsl(var(--mint-border))]/30' 
            : 'bg-gradient-to-r from-emerald to-emerald/80 emerald-glow'
        }
        ${!freePlanStatus.canAddFortune ? 'opacity-50' : ''}
      `}
      aria-label={
        !freePlanStatus.canAddFortune 
          ? "Daily limit reached" 
          : selectedDate 
            ? `Add fortune for ${selectedDate.toLocaleDateString()}` 
            : "Add fortune"
      }
    >
      {!freePlanStatus.canAddFortune ? (
        <Lock size={24} weight="bold" />
      ) : (
        <Plus size={24} weight="bold" />
      )}
    </button>
  );
};