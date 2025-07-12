import { Plus } from '@phosphor-icons/react';

interface FloatingActionButtonProps {
  onClick: () => void;
}

export const FloatingActionButton = ({ onClick }: FloatingActionButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="
        fixed bottom-6 right-6 md:hidden
        w-14 h-14 rounded-full
        bg-gradient-to-r from-emerald to-emerald/80
        text-ivory
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:scale-110 active:scale-95
        z-40
        emerald-glow
      "
      aria-label="Add fortune"
    >
      <Plus size={24} weight="bold" />
    </button>
  );
};