import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-md w-full h-[90vh] max-h-[90vh] overflow-y-auto">
        <KnowMyselfWizard selectedDate={dateToUse} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};