import { useState } from 'react';
import { X, Plus, Sparkle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FortuneCategory } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';

interface AddFortuneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFortuneAdded: () => void;
}

const categories: FortuneCategory[] = ['Wealth', 'Health', 'Love', 'Opportunity', 'Other'];

const shootCoins = () => {
  const colors = ['#D6B94C', '#046B4A', '#F2F0E8'];
  
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors,
    shapes: ['circle'],
    gravity: 0.9,
    scalar: 1.2,
  });
  
  // Vibrate if supported
  if ('vibrate' in navigator) {
    navigator.vibrate(30);
  }
};

export const AddFortuneModal = ({ isOpen, onClose, onFortuneAdded }: AddFortuneModalProps) => {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<FortuneCategory>('Wealth');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please enter your fortune",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to track fortunes",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('fortunes')
        .insert([
          {
            user_id: user.id,
            text: text.trim(),
            category,
          }
        ]);

      if (error) throw error;

      // Success animations and feedback
      shootCoins();
      
      toast({
        title: "Fortune Tracked! ✨",
        description: "Your fortune has been added to the universe",
      });

      setText('');
      setCategory('Wealth');
      onFortuneAdded();
      onClose();
    } catch (error) {
      console.error('Error adding fortune:', error);
      toast({
        title: "Error",
        description: "Failed to track fortune. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md luxury-card p-6 transform transition-transform duration-200 hover:scale-[1.02]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-semibold flex items-center gap-2">
            <Sparkle size={24} className="text-gold" />
            Track Fortune
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              What fortune came your way today?
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe your fortune, opportunity, or positive moment..."
              className="min-h-24 focus:border-gold focus:ring-gold/20"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {text.length}/500 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Category
            </label>
            <Select value={category} onValueChange={(value) => setCategory(value as FortuneCategory)}>
              <SelectTrigger className="focus:border-gold focus:ring-gold/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !text.trim()}
            className="luxury-button w-full"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Tracking...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Plus size={18} />
                Track Fortune
              </div>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};