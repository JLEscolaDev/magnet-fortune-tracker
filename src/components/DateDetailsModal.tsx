import { useState, useEffect, useRef } from 'react';
import { X, CurrencyDollar, Heart, HeartStraight, Sparkle, PencilSimple, Trash } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import { Fortune } from '@/types/fortune';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { FortuneModal } from '@/components/FortuneModal';
import { FortunePhoto } from '@/components/FortunePhoto';
import { deleteFortune } from "@/lib/fortunes";
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
  const [deletingFortunes, setDeletingFortunes] = useState<Set<string>>(new Set());
  const deleteTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const fabClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Categories that allow a numeric value (user custom + built-in defaults)
  const [valueCategories, setValueCategories] = useState<Set<string>>(new Set(['Wealth']));
  
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        // Fetch user's custom categories that explicitly allow numeric values
        const { data, error } = await supabase
          .from('custom_categories')
          .select('name, has_numeric_value')
          .eq('has_numeric_value', true);
  
        if (!error && Array.isArray(data)) {
          const withValue = data
            .filter((c) => c.has_numeric_value)
            .map((c) => c.name)
            .filter((n): n is string => typeof n === 'string' && n.length > 0);
  
          // Add built-in category that supports values
          setValueCategories(new Set(['Wealth', ...withValue]));
        }
      } catch {
        // ignore – if it fails, we only keep the default
      }
    })();
  }, [isOpen]);

  // Cleanup all timeouts on unmount - MUST be before any early returns!
  useEffect(() => {
    return () => {
      deleteTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      deleteTimeoutsRef.current.clear();
      if (fabClickTimeoutRef.current) {
        clearTimeout(fabClickTimeoutRef.current);
        fabClickTimeoutRef.current = null;
      }
    };
  }, []);

  // Early return AFTER all hooks
  if (!isOpen || !date) return null;

  const handleEditFortune = (fortune: Fortune) => {
    setEditingFortune(fortune);
    setIsEditModalOpen(true);
  };

  const handleDeleteFortune = async (fortuneId: string) => {
    // Clear any existing timeout for this fortune
    const existingTimeout = deleteTimeoutsRef.current.get(fortuneId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    try {
      // Immediately start deleting animation
      setDeletingFortunes(prev => new Set(prev).add(fortuneId));
      
      await deleteFortune(fortuneId);

      toast({
        title: "Fortune deleted",
        description: "Your fortune has been removed.",
      });

      onFortunesUpdated?.();
      window.dispatchEvent(new Event("fortunesUpdated"));
      
      // Wait for animation to complete then cleanup
      const timeoutId = setTimeout(() => {
        deleteTimeoutsRef.current.delete(fortuneId);
        setDeletingFortunes(prev => {
          const newSet = new Set(prev);
          newSet.delete(fortuneId);
          return newSet;
        });
        
        // Close modal if no more fortunes
        const remainingFortunes = fortunes.filter(f => f.id !== fortuneId);
        if (remainingFortunes.length === 0) {
          onClose();
        }
      }, 300);
      
      deleteTimeoutsRef.current.set(fortuneId, timeoutId);
      
    } catch (error) {
      console.error('Error deleting fortune:', error);
      toast({
        title: "Error deleting fortune",
        description: "Please try again.",
        variant: "destructive",
      });
      
      // Remove from deleting set on error
      setDeletingFortunes(prev => {
        const newSet = new Set(prev);
        newSet.delete(fortuneId);
        return newSet;
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No fortunes recorded for this day
              </p>
              <Button 
                onClick={() => {
                  onClose();
                  // Trigger the floating action button click
                  if (fabClickTimeoutRef.current) {
                    clearTimeout(fabClickTimeoutRef.current);
                  }
                  fabClickTimeoutRef.current = setTimeout(() => {
                    const fabButton = document.querySelector('[aria-label*="Add fortune"]') as HTMLButtonElement;
                    if (fabButton) fabButton.click();
                    fabClickTimeoutRef.current = null;
                  }, 100);
                }}
                className="luxury-button"
              >
                Add Fortune
              </Button>
            </div>
          ) : (
            fortunes.filter(fortune => !deletingFortunes.has(fortune.id)).map((fortune) => (
              <div 
                key={fortune.id} 
                className={`group luxury-card p-4 bg-muted/20 relative transition-all duration-300 transform ${
                  deletingFortunes.has(fortune.id) 
                    ? 'opacity-0 scale-95 translate-x-4' 
                    : 'opacity-100 scale-100 translate-x-0'
                }`}
              >
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
                      <AlertDialogContent className="z-[9999]">
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
                
                {/* Show photo if exists */}
                <FortunePhoto fortuneId={fortune.id} className="w-full mt-3" />
                
                <div className="flex items-center gap-2 mt-2">
                  {valueCategories.has(fortune.category) && Number(fortune.fortune_value) > 0 && (
                    <div className="text-xs text-gold font-medium">
                      {Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(fortune.fortune_value))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <FortuneModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        fortune={editingFortune}
        onFortuneUpdated={handleFortuneUpdated}
        mode="edit"
      />
    </div>
  );
};