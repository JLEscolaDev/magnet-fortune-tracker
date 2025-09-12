import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KnowMyselfWizard } from '../knowmyself/KnowMyselfWizard';
import { Brain } from 'lucide-react';

interface KnowMyselfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KnowMyselfModal = ({ open, onOpenChange }: KnowMyselfModalProps) => {
  const today = new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden h-[85vh] md:h-auto md:max-h-[90vh]">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain className="text-primary" size={18} />
            Know Myself Today
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-0 flex-1 overflow-hidden">
          <KnowMyselfWizard selectedDate={today} />
        </div>
      </DialogContent>
    </Dialog>
  );
};