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
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden h-[80vh] md:h-auto md:max-h-[85vh]">
        <div className="px-0 flex-1 overflow-hidden">
          <KnowMyselfWizard selectedDate={today} />
        </div>
      </DialogContent>
    </Dialog>
  );
};