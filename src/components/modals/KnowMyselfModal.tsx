import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { KnowMyselfWizard } from '../knowmyself/KnowMyselfWizard';

interface KnowMyselfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KnowMyselfModal = ({ open, onOpenChange }: KnowMyselfModalProps) => {
  const today = new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-md w-full max-h-[80vh] overflow-auto">
        <KnowMyselfWizard selectedDate={today} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};