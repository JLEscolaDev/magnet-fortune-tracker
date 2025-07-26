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
    // Always open the modal - restrictions will be shown inside
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`
        fixed bottom-20 right-6 md:hidden
        w-14 h-14 rounded-full
        text-ivory
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:scale-110 active:scale-95
        z-[80]
        ${selectedDate && !isSameDay(selectedDate, new Date())
          ? 'bg-gradient-to-r from-[hsl(var(--mint))] to-[hsl(var(--mint-border))] shadow-lg shadow-[hsl(var(--mint-border))]/30' 
          : 'bg-gradient-to-r from-emerald to-emerald/80 emerald-glow'
        }
      `}
      aria-label={
        selectedDate 
          ? `Add fortune for ${selectedDate.toLocaleDateString()}` 
          : "Add fortune"
      }
    >
      <Plus size={24} weight="bold" />
    </button>
  );
};