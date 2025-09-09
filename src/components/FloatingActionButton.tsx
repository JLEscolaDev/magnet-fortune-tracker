import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleClick = () => {
    // Always open the modal - restrictions will be shown inside
    onClick();
    
    if (!isStepCompleted('create-fortune')) {
      showTutorial('create-fortune');
    }
  };

  if (!mounted) return null;

  const isAltDate = selectedDate && !isSameDay(selectedDate, new Date());

  const button = (
    <button
      onClick={handleClick}
      className={`
        md:hidden
        w-14 h-14 rounded-full
        text-ivory
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:scale-110 active:scale-95
        z-40
        relative
        ${isAltDate
          ? 'bg-gradient-to-r from-[hsl(var(--mint))] to-[hsl(var(--mint-border))] shadow-lg shadow-[hsl(var(--mint-border))]/30'
          : 'bg-gradient-to-r from-emerald to-emerald/80 emerald-glow'
        }
      `}
      style={{
        position: 'fixed',
        // Higher on smaller devices, respect safe areas
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
      }}
      aria-label={
        selectedDate
          ? `Add fortune for ${selectedDate.toLocaleDateString()}`
          : 'Add fortune'
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

  return createPortal(button, document.body);
};