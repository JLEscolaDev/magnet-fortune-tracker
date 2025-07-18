import { useState } from 'react';
import { X, CurrencyDollar, Heart, HeartStraight, Sparkle, PencilSimple, Trash } from '@phosphor-icons/react';
import { Fortune } from '@/types/fortune';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { EditFortuneModal } from '@/components/EditFortuneModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface DateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  fortunes: Fortune[];
  onFortunesUpdated?: () => void;
}

export const DateDetailsModal = ({ isOpen, onClose, date, fortunes, onFortunesUpdated }: DateDetailsModalProps) => {
  const [editingFortune, setEditingFortune] = useState<Fortune | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { toast } = useToast();

  if (!isOpen || !date) return null;

  const handleEditFortune = (fortune: Fortune) => {
    setEditingFortune(fortune);
    setIsEditModalOpen(true);
  };

  const handleDeleteFortune = async (fortuneId: string) => {
    try {
      const { error } = await supabase
        .from('fortunes')
        .delete()
        .eq('id', fortuneId);

      if (error) throw error;

      toast({
        title: "Fortune deleted",
        description: "Your fortune has been removed.",
      });

      onFortunesUpdated?.();
      window.dispatchEvent(new Event("fortunesUpdated"));
      onClose(); // Close modal after deletion
    } catch (error) {
      console.error('Error deleting fortune:', error);
      toast({
        title: "Error deleting fortune",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFortuneUpdated = () => {
    onFortunesUpdated?.();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Wealth':
        return <CurrencyDollar size={16} className="text-gold" />;
      case 'Health':
        return <HeartStraight size={16} className="text-red-400" />;
      case 'Love':
        return <Heart size={16} className="text-pink-400" />;
      case 'Opportunity':
        return <Sparkle size={16} className="text-emerald" />;
      default:
        return <Sparkle size={16} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md luxury-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-semibold">
            {format(date, 'MMMM d, yyyy')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {fortunes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No fortunes recorded for this day
            </p>
          ) : (
            fortunes.map((fortune) => (
              <div key={fortune.id} className="group luxury-card p-4 bg-muted/20 relative">
                <div className="flex items-center gap-2 mb-2">
                  {getCategoryIcon(fortune.category)}
                  <span className="text-sm font-medium text-gold">
                    {fortune.category}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(fortune.created_at), 'h:mm a')}
                  </span>
                  {/* Edit/Delete buttons */}
                  <div className="flex gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditFortune(fortune)}
                      className="h-6 w-6 p-0 hover:bg-gold/20"
                    >
                      <PencilSimple size={12} className="text-gold" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-red-500/20"
                        >
                          <Trash size={12} className="text-red-400" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Fortune</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this fortune? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteFortune(fortune.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{fortune.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  {fortune.fortune_level && (
                    <div className="text-xs text-muted-foreground">
                      Level: {fortune.fortune_level}
                    </div>
                  )}
                  {fortune.fortune_value && (
                    <div className="text-xs text-gold font-medium">
                      ${fortune.fortune_value}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <EditFortuneModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        fortune={editingFortune}
        onFortuneUpdated={handleFortuneUpdated}
      />
    </div>
  );
};