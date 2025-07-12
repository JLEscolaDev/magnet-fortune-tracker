import { Magnet } from '@phosphor-icons/react';

export const FortuneIcon = () => {
  return (
    <div className="relative">
      <Magnet 
        size={32} 
        weight="fill" 
        className="text-gold animate-pulse"
      />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald rounded-full animate-ping" />
    </div>
  );
};