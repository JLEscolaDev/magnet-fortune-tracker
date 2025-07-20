import { Plus } from '@phosphor-icons/react';

interface FloatingActionButtonProps {
  onClick: () => void;
  selectedDate?: Date | null;
}

export const FloatingActionButton = ({ onClick, selectedDate }: FloatingActionButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 md:hidden
        w-14 h-14 rounded-full
        text-ivory
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:scale-110 active:scale-95
        z-40
        ${selectedDate 
          ? 'bg-gradient-to-r from-emerald to-emerald/80 emerald-glow' 
          : 'bg-gradient-to-r from-emerald to-emerald/80 emerald-glow'
        }
      `}
      aria-label={selectedDate ? `Add fortune for ${selectedDate.toLocaleDateString()}` : "Add fortune"}
    >
      <Plus size={24} weight="bold" />
    </button>
  );
};