import { useRef, useEffect } from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_OPTIONS = [
  '📝', '✅', '⭐', '🎯', '💡', '🔥', '💪', '🚀',
  '💰', '❤️', '🌟', '📌', '🎉', '⚡', '🏆', '💎',
  '📊', '🎨', '🔔', '📞', '✉️', '🛒', '🏠', '🎁'
];

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 p-2 bg-popover border border-border rounded-lg shadow-lg grid grid-cols-8 gap-1"
    >
      {EMOJI_OPTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="w-8 h-8 flex items-center justify-center text-lg hover:bg-accent rounded transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
