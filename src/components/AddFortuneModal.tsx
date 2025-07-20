import { useState, useEffect } from 'react';
import { X, Plus, Sparkle, CurrencyDollar } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FortuneCategory, CategoryData } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';

interface AddFortuneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFortuneAdded: () => void;
  selectedDate?: Date | null;
}

  const defaultCategories: CategoryData[] = [
    { name: 'Wealth', hasNumericValue: true, color: 'hsl(var(--gold))' },
    { name: 'Health', hasNumericValue: false, color: 'hsl(var(--health))' },
    { name: 'Love', hasNumericValue: false, color: 'hsl(var(--love))' },
    { name: 'Opportunity', hasNumericValue: false, color: 'hsl(var(--opportunity))' },
    { name: 'Other', hasNumericValue: false, color: 'hsl(var(--muted-foreground))' }
  ];

const shootCoins = () => {
  const colors = ['#D6B94C', '#FFD700', '#F2F0E8'];
  
  // Gold coin animation for wealth
  confetti({
    particleCount: 150,
    spread: 90,
    origin: { y: 0.5 },
    colors,
    shapes: ['circle'],
    gravity: 1.2,
    scalar: 1.5,
    drift: 0.1,
    ticks: 300,
  });
  
  // Additional gold sparkles
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 40,
      origin: { y: 0.4 },
      colors: ['#FFD700', '#D6B94C'],
      shapes: ['circle'],
      gravity: 0.6,
      scalar: 0.8,
    });
  }, 200);
  
  // Vibrate if supported
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 50, 100]);
  }
};

const shootConfetti = () => {
  const colors = ['#046B4A', '#F2F0E8', '#D6B94C'];
  
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.6 },
    colors,
    gravity: 0.8,
    scalar: 1.0,
  });
  
  // Vibrate if supported
  if ('vibrate' in navigator) {
    navigator.vibrate(30);
  }
};

export const AddFortuneModal = ({ isOpen, onClose, onFortuneAdded, selectedDate }: AddFortuneModalProps) => {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<FortuneCategory>('Wealth');
  const [fortuneValue, setFortuneValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryData[]>(defaultCategories);
  const { toast } = useToast();

  // Load custom categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('custom_categories')
        .select('*')
        .eq('user_id', user.id);

      if (data) {
        const customCatsData = data.map(cat => ({
          name: cat.name,
          hasNumericValue: cat.has_numeric_value,
          color: cat.color
        }));
        setCategories([...defaultCategories, ...customCatsData]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const getCurrentCategory = () => {
    return categories.find(cat => cat.name === category) || defaultCategories[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please enter your fortune",
        variant: "destructive",
      });
      
      // Error feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
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

      const insertData: any = {
        user_id: user.id,
        text: text.trim(),
        category,
        fortune_value: getCurrentCategory().hasNumericValue && fortuneValue 
          ? parseFloat(fortuneValue) 
          : null
      };

      // If a specific date is selected, set it as the created_at timestamp
      if (selectedDate) {
        insertData.created_at = selectedDate.toISOString();
      }

      const { error } = await supabase
        .from('fortunes')
        .insert([insertData]);

      if (error) throw error;

      // Success animations and feedback - conditional based on category
      if (category === 'Wealth') {
        shootCoins();
      } else {
        shootConfetti();
      }
      
      toast({
        title: "Fortune Tracked! ✨",
        description: "Your fortune has been added to the universe",
      });

      setText('');
      setCategory('Wealth');
      setFortuneValue('');
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
      <div className="relative w-full max-w-md luxury-card p-6 transform transition-transform duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-semibold flex items-center gap-2">
            <Sparkle size={24} className="text-gold" />
            {selectedDate ? `Track Fortune for ${selectedDate.toLocaleDateString()}` : 'Track Fortune'}
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
              <SelectContent className="bg-card border-border z-50">
                {categories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    <div className="flex items-center gap-2">
                      {cat.name === 'Wealth' && <CurrencyDollar size={14} className="text-gold" />}
                      <span>{cat.name}</span>
                      {cat.hasNumericValue && (
                        <span className="text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                          $
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Numeric Value Input - Show only if category has numeric value */}
          {getCurrentCategory().hasNumericValue && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Value (Optional)
              </label>
              <div className="relative">
                <CurrencyDollar size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gold" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fortuneValue}
                  onChange={(e) => setFortuneValue(e.target.value)}
                  placeholder="0.00"
                  className="pl-10 focus:border-gold focus:ring-gold/20"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Track the monetary value associated with this fortune
              </p>
            </div>
          )}

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