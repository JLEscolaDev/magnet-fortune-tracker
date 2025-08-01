import { useState, useEffect } from 'react';
import { X, Plus, Sparkle, CurrencyDollar, Crown, Lock } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FortuneCategory, CategoryData } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeText, validateNumericValue, validateCategory, formRateLimiter } from '@/lib/security';
import { useFreePlanLimits } from '@/hooks/useFreePlanLimits';
import { useAppState } from '@/contexts/AppStateContext';
import { SUBSCRIPTION_LIMITS } from '@/config/limits';
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
  const [category, setCategory] = useState<FortuneCategory>('');
  const [fortuneValue, setFortuneValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryData[]>(defaultCategories);
  const { toast } = useToast();
  const freePlanStatus = useFreePlanLimits();
  const { activeSubscription, fortunesCountToday, addError } = useAppState();

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
    
    // Rate limiting check
    if (!formRateLimiter.canProceed('add-fortune')) {
      toast({
        title: "Too many requests",
        description: "Please wait a moment before submitting again",
        variant: "destructive",
      });
      return;
    }

    // Check free plan limits before submission - but allow Pro users to bypass
    const hasActiveSubscription = activeSubscription !== null;
    if (!hasActiveSubscription && !freePlanStatus.canAddFortune) {
      // Fallback check using app state if freePlanStatus is not accurate
      const dailyLimit = fortunesCountToday >= SUBSCRIPTION_LIMITS.FREE_RESTRICTED_DAILY_LIMIT;
      if (dailyLimit) {
        toast({
          title: "Daily limit reached",
          description: "Your free plan now limits you to 1 fortune per day. Upgrade to Pro for unlimited access!",
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      // Input validation and sanitization
      if (!text.trim() || !category) {
        toast({
          title: "Error",
          description: !text.trim() ? "Please enter your fortune" : "Please select a category",
          variant: "destructive",
        });
        
        // Error feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
        
        return;
      }

      // Sanitize and validate inputs
      const sanitizedText = sanitizeText(text, 500);
      const validatedCategory = validateCategory(category);
      let validatedValue: number | null = null;
      
      if (getCurrentCategory().hasNumericValue && fortuneValue) {
        validatedValue = validateNumericValue(fortuneValue, 0, 1000000);
      }

      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to track fortunes",
          variant: "destructive",
        });
        return;
      }

      const fortuneData = {
        text: sanitizedText,
        category: validatedCategory,
        fortune_value: validatedValue,
        created_at: selectedDate?.toISOString()
      };

      // Use the backend validation function for defense in depth
      const { data: insertResult, error } = await supabase.functions.invoke('validate-and-insert-fortune', {
        body: fortuneData
      });

      if (error) {
        // Handle specific error codes from the backend
      if (error.message?.includes('FREE_DAILY_LIMIT_REACHED')) {
        addError('fortune-submission', 'Daily limit reached during server validation');
        toast({
          title: "Daily limit reached",
          description: "Your free plan now limits you to 1 fortune per day. Upgrade to Pro for unlimited access!",
          variant: "destructive",
        });
        return;
      }
        throw error;
      }

      if (!insertResult?.success) {
        throw new Error(insertResult?.error || 'Failed to add fortune');
      }

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
      setCategory('');
      setFortuneValue('');
      onFortuneAdded();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error adding fortune:', error);
      addError('fortune-submission', errorMessage);
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

  const restrictionMessage = freePlanStatus.restrictionMessage;

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

        {/* Free Plan Status Banner - Only show when actually blocked and no active subscription */}
        {!freePlanStatus.loading && freePlanStatus.isRestricted && !freePlanStatus.canAddFortune && !activeSubscription && (
          <div className="bg-gradient-to-r from-warning/10 to-accent/10 border border-warning/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="bg-gradient-to-r from-warning to-accent p-1.5 rounded-full flex-shrink-0">
                <Lock size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground mb-1">Limited Access</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {restrictionMessage}
                </p>
                <Button 
                  size="sm"
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground"
                >
                  <Crown size={16} className="mr-2" />
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          </div>
        )}

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
                <SelectValue placeholder="Select a category" />
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
            {!category && (
              <p className="text-xs text-destructive mt-1">
                Please select a category to continue
              </p>
            )}
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
            disabled={isLoading || !text.trim() || !category || (!activeSubscription && !freePlanStatus.canAddFortune)}
            className="luxury-button w-full"
          >
            {!activeSubscription && !freePlanStatus.canAddFortune ? (
              <div className="flex items-center gap-2">
                <Lock size={18} />
                Daily Limit Reached
              </div>
            ) : isLoading ? (
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