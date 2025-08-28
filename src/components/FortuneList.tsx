import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Fortune } from '@/types/fortune';
import { 
  CurrencyDollar, 
  Heart, 
  HeartStraight, 
  Sparkle, 
  Question,
  PencilSimple,
  Trash
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { FortuneModal } from '@/components/FortuneModal';
import { deleteFortune } from '@/lib/fortunes';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TransitionGroup, CSSTransition } from 'react-transition-group';

const ConfirmDeleteDialog = ({
  onConfirm,
  trigger,
}: {
  onConfirm: () => void;
  trigger: React.ReactNode;
}) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Fortune</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete this fortune? This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

interface FortuneListProps {
  fortunes: Fortune[];
  title?: string;
  onFortunesUpdated?: () => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Wealth':
      return <CurrencyDollar size={16} className="text-white" />;
    case 'Health':
      return <HeartStraight size={16} className="text-white" />;
    case 'Love':
      return <Heart size={16} className="text-white" />;
    case 'Opportunity':
      return <Sparkle size={16} className="text-white" />;
    default:
      return <Question size={16} className="text-white" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Wealth':
      return 'bg-gold/30 text-gold border-gold/50';
    case 'Health':
      return 'bg-red-400/30 text-red-300 border-red-400/50';
    case 'Love':
      return 'bg-pink-400/30 text-pink-300 border-pink-400/50';
    case 'Opportunity':
      return 'bg-emerald/30 text-emerald border-emerald/50';
    default:
      return 'bg-white/20 text-white border-white/30';
  }
};

export const FortuneList = ({ fortunes, title = "Today's Fortunes", onFortunesUpdated }: FortuneListProps) => {
  const [editingFortune, setEditingFortune] = useState<Fortune | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingFortunes, setDeletingFortunes] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    const handleUpdate = () => {
      onFortunesUpdated?.();
    };
    window.addEventListener("fortunesUpdated", handleUpdate);
    return () => {
      window.removeEventListener("fortunesUpdated", handleUpdate);
    };
  }, []);

  const handleEditFortune = (fortune: Fortune) => {
    setEditingFortune(fortune);
    setIsEditModalOpen(true);
  };

  const handleDeleteFortune = async (fortuneId: string) => {
    // Start fade out animation
    setDeletingFortunes(prev => new Set(prev).add(fortuneId));
    
    // Wait for animation to complete
    setTimeout(async () => {
      try {
        await deleteFortune(fortuneId);

        toast({
          title: "Fortune deleted",
          description: "Your fortune has been removed.",
        });

        onFortunesUpdated?.();
        window.dispatchEvent(new Event("fortunesUpdated"));
        
        // Remove from deleting set
        setDeletingFortunes(prev => {
          const newSet = new Set(prev);
          newSet.delete(fortuneId);
          return newSet;
        });
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
    }, 300); // Match the fade-out animation duration
  };

  const handleFortuneUpdated = () => {
    onFortunesUpdated?.();
  };
  if (fortunes.length === 0) {
    return (
      <div className="luxury-card p-6">
        <h3 className="text-lg font-heading font-medium mb-4">{title}</h3>
        <div className="text-center py-8">
          <Sparkle size={48} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No fortunes tracked yet</p>
          <p className="text-sm text-muted-foreground">Tap the + button to add your first fortune</p>
        </div>
      </div>
    );
  }

  return (
    <div className="luxury-card p-6">
      <h3 className="text-lg font-heading font-medium mb-4">{title}</h3>
      <TransitionGroup component="div" className="space-y-3">
        {fortunes.filter(fortune => !deletingFortunes.has(fortune.id)).map((fortune) => (
          <CSSTransition
            key={fortune.id}
            timeout={300}
            classNames="fortune"
          >
            <div
              className={`group p-4 rounded-lg border border-muted/20 hover:border-gold/30 transition-all duration-300 relative text-white ${
                deletingFortunes.has(fortune.id) 
                  ? 'opacity-0 scale-95 translate-x-4' 
                  : 'opacity-100 scale-100 translate-x-0'
              }`}
              style={{ backgroundColor: 'hsl(var(--fortune-item))' }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm leading-relaxed flex-1">{fortune.text}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(fortune.created_at), 'HH:mm')}
                  </span>
                  {/* Edit/Delete buttons - visible on hover on desktop */}
                  <div className="hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditFortune(fortune)}
                      className="h-6 w-6 p-0 hover:bg-gold/20"
                    >
                      <PencilSimple size={12} className="text-gold" />
                    </Button>
                    <ConfirmDeleteDialog
                      onConfirm={() => handleDeleteFortune(fortune.id)}
                      trigger={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-red-500/20"
                        >
                          <Trash size={12} className="text-red-400" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${getCategoryColor(fortune.category)}`}
                  >
                    {getCategoryIcon(fortune.category)}
                    {fortune.category}
                  </span>
                  {fortune.category === 'Wealth' && fortune.fortune_value && fortune.fortune_value > 0 && (
                    <span className="text-xs text-gold font-medium">
                      ${fortune.fortune_value}
                    </span>
                  )}
                </div>
                {/* Mobile edit/delete buttons - always visible */}
                <div className="flex md:hidden gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditFortune(fortune)}
                    className="h-6 w-6 p-0 hover:bg-gold/20"
                  >
                    <PencilSimple size={12} className="text-gold" />
                  </Button>
                  <ConfirmDeleteDialog
                    onConfirm={() => handleDeleteFortune(fortune.id)}
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-red-500/20"
                      >
                        <Trash size={12} className="text-red-400" />
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
          </CSSTransition>
        ))}
      </TransitionGroup>

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