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
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Brain className="text-primary" size={20} />
            Know Myself Today
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-0">
          <KnowMyselfWizard selectedDate={today} />
        </div>
      </DialogContent>
    </Dialog>
  );
};