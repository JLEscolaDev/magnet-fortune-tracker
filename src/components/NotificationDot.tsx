import React from 'react';
import { cn } from '@/lib/utils';

interface NotificationDotProps {
  show: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const NotificationDot: React.FC<NotificationDotProps> = ({ 
  show, 
  className,
  size = 'sm' 
}) => {
  if (!show) return null;

  return (
    <div 
      className={cn(
        "absolute rounded-full bg-gradient-to-r from-emerald to-emerald-400 animate-pulse",
        size === 'sm' ? "w-2 h-2" : "w-3 h-3",
        "shadow-lg shadow-emerald/50",
        className
      )}
      style={{
        filter: 'drop-shadow(0 0 4px hsl(var(--emerald) / 0.6))'
      }}
    />
  );
};