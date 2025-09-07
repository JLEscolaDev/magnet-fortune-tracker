import { Plus } from '@phosphor-icons/react';
import { isSameDay } from 'date-fns';
import { useTutorial } from '@/contexts/TutorialContext';
import { NotificationDot } from './NotificationDot';

interface FloatingActionButtonProps {
  onClick: () => void;
  selectedDate?: Date | null;
}

export const FloatingActionButton = ({ onClick, selectedDate }: FloatingActionButtonProps) => {
  const { isStepCompleted, showTutorial } = useTutorial();

  const handleClick = () => {
    // Always open the modal - restrictions will be shown inside
    onClick();
    
    if (!isStepCompleted('create-fortune')) {
      showTutorial('create-fortune');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        fixed bottom-20 right-4 md:hidden
        w-14 h-14 rounded-full
        text-ivory
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:scale-110 active:scale-95
        z-[80]
        relative
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
      <div className="relative">
        <Plus size={24} weight="bold" />
        <NotificationDot 
          show={!isStepCompleted('create-fortune')} 
          className="top-0 right-0 -mt-3 -mr-3"
          size="md"
        />
      </div>
    </button>
  );
};