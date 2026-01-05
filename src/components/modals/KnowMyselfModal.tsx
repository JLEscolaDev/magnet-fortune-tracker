import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { KnowMyselfWizard } from '../knowmyself/KnowMyselfWizard';

interface KnowMyselfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
}

export const KnowMyselfModal = ({ open, onOpenChange, selectedDate }: KnowMyselfModalProps) => {
  const dateToUse = selectedDate || new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="p-0 border-0 bg-transparent shadow-none w-[90%] md:w-[540pt] md:max-w-[720px] overflow-hidden flex flex-col [&>button]:hidden"
        style={{ 
          background: 'transparent',
          height: '90vh',
          maxHeight: '90vh'
        }}
      >
        <DialogTitle className="sr-only">Daily Wellness Survey</DialogTitle>
        <DialogDescription className="sr-only">
          Track your daily mood, energy levels, and wellness metrics
        </DialogDescription>
        <KnowMyselfWizard selectedDate={dateToUse} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};