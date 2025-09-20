import { useState, useEffect } from 'react';
import { X, Plus, Sparkle, CurrencyDollar, Crown, Lock, TrendUp, Trophy, Star } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FortuneCategory, CategoryData, Fortune } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeText, validateNumericValue, validateCategory, formRateLimiter } from '@/lib/security';
import { useFreePlanLimits } from '@/hooks/useFreePlanLimits';
import { useAppState } from '@/contexts/AppStateContext';
import { SUBSCRIPTION_LIMITS } from '@/config/limits';
import { addFortune, updateFortune } from '@/lib/fortunes';
import confetti from 'canvas-confetti';

interface FortuneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFortuneAdded?: () => void;
  onFortuneUpdated?: () => void;
  selectedDate?: Date | null;
  fortune?: Fortune | null; // If provided, we're in edit mode
  mode?: 'create' | 'edit'; // Explicit mode specification
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

export const FortuneModal = ({ 
  isOpen, 
  onClose, 
  onFortuneAdded, 
  onFortuneUpdated, 
  selectedDate, 
  fortune, 
  mode 
}: FortuneModalProps) => {
  // Determine if we're in edit mode
  const isEditMode = mode === 'edit' || !!fortune;
  
  const [text, setText] = useState('');
  const [category, setCategory] = useState<FortuneCategory>('');
  const [fortuneValue, setFortuneValue] = useState('');
  const [impactLevel, setImpactLevel] = useState<string>('small_step');
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryData[]>(defaultCategories);
  const [bigWinsCount, setBigWinsCount] = useState<number>(0);
  const { toast } = useToast();
  const freePlanStatus = useFreePlanLimits();
  const { activeSubscription, fortunesCountToday, addError } = useAppState();

  // Debug logging (only for create mode)
  if (!isEditMode) {
    console.log('[FORTUNE_MODAL] Debug info:', {
      freePlanStatus,
      activeSubscription,
      fortunesCountToday,
      isLoading
    });
  }

  // Load custom categories and big wins count on mount
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      if (!isEditMode) {
        loadBigWinsCount();
      }
    }
  }, [isOpen, isEditMode]);

  // Populate form when editing - wait for categories to load
  useEffect(() => {
    if (isEditMode && fortune && isOpen && categories.length > 0) {
      console.log('[FORTUNE_MODAL] Populating edit form:', { 
        fortuneCategory: fortune.category, 
        availableCategories: categories.map(c => c.name) 
      });
      setText(fortune.text || '');
      setCategory(fortune.category as FortuneCategory || '');
      setFortuneValue(fortune.fortune_value ? String(fortune.fortune_value) : '');
      setImpactLevel(fortune.impact_level || 'small_step');
    } else if (!isEditMode && isOpen) {
      // Reset form for create mode
      setText('');
      setCategory('');
      setFortuneValue('');
      setImpactLevel('small_step');
    }
  }, [isEditMode, fortune, isOpen, categories]);

  const loadBigWinsCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const endOfYear = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));

      // Use the fortune_list RPC and filter on client side to avoid TypeScript issues
      const { data } = await (supabase.rpc as any)('fortune_list', {
        p_from: startOfYear.toISOString(),
        p_to: endOfYear.toISOString()
      });

      if (data) {
        const bigWins = data.filter((fortune: any) => fortune.impact_level === 'big_win');
        setBigWinsCount(bigWins.length);
      }
    } catch (error) {
      console.error('Error loading big wins count:', error);
    }
  };

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
    const rateLimitKey = isEditMode ? 'edit-fortune' : 'add-fortune';
    if (!formRateLimiter.canProceed(rateLimitKey)) {
      toast({
        title: "Too many requests",
        description: "Please wait a moment before submitting again",
        variant: "destructive",
      });
      return;
    }

    // For create mode, check free plan limits
    if (!isEditMode) {
      const hasActiveSubscription = activeSubscription !== null;
      if (!hasActiveSubscription && !freePlanStatus.canAddFortune) {
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
      let sanitizedText: string;
      let validatedCategory: string;
      let validatedValue: number | null = null;

      try {
        sanitizedText = sanitizeText(text, 500);
        validatedCategory = validateCategory(category);
      } catch (validationError) {
        const errorMessage = validationError instanceof Error ? validationError.message : 'Validation failed';
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
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

      if (isEditMode && fortune) {
        // Update existing fortune
        const updateData: any = {
          text: sanitizedText,
          category: validatedCategory,
        };

        // Only include fortune_value if the category supports numeric values
        if (getCurrentCategory().hasNumericValue) {
          updateData.fortune_value = validatedValue;
        } else {
          updateData.fortune_value = null;
        }

        // Include impact_level if it exists
        if (impactLevel) {
          updateData.impact_level = impactLevel;
        }

        await updateFortune(fortune.id, updateData);

        toast({
          title: "Fortune Updated! ✨",
          description: "Your fortune has been successfully updated",
        });

        onFortuneUpdated?.();
      } else {
        // Create new fortune
        const result = await addFortune(sanitizedText, validatedCategory, validatedValue || 0, selectedDate, impactLevel);

        // Celebration for first action of day
        if (result.streakInfo?.firstOfDay) {
          // Emit analytics
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'first_action_of_day', {
              source: 'fortune'
            });
            (window as any).gtag('event', 'streak_celebrate', {
              currentStreak: result.streakInfo.currentStreak
            });
          }

          // Confetti celebration
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FFA500', '#FF6347'],
          });

          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(15);
          }

          // Toast with streak info
          toast({
            title: `Day ${result.streakInfo.currentStreak} streak! 🎉`,
            description: "Great work tracking your fortune!",
            duration: 4000,
          });
        } else {
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
        }

        // Refresh big wins count if a big win was added
        if (impactLevel === 'big_win') {
          loadBigWinsCount();
        }

        onFortuneAdded?.();
      }

      // Reset form
      setText('');
      setCategory('');
      setFortuneValue('');
      setImpactLevel('small_step');
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} fortune:`, error);
      if (!isEditMode) {
        addError('fortune-submission', errorMessage);
      }
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'track'} fortune. Please try again.`,
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
            {isEditMode 
              ? 'Edit Fortune' 
              : selectedDate 
                ? `Track Fortune for ${selectedDate.toLocaleDateString()}` 
                : 'Track Fortune'
            }
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Free Plan Status Banner - Only show in create mode when actually blocked */}
        {!isEditMode && !freePlanStatus.loading && freePlanStatus.isRestricted && !freePlanStatus.canAddFortune && !activeSubscription && (
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
            <Select value={category || undefined} onValueChange={(value) => setCategory(value as FortuneCategory)}>
              <SelectTrigger className="focus:border-gold focus:ring-gold/20">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border shadow-lg z-[60]" sideOffset={4}>
                {categories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name} className="cursor-pointer">
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

          {/* Impact Level - Only show in create mode or if editing a fortune with impact_level */}
          {(!isEditMode || (isEditMode && fortune?.impact_level)) && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Impact Level
              </label>
              <div className="space-y-3">
                {/* Impact Level Selector */}
                <div className="flex gap-2">
                  {[
                    { value: 'small_step', label: 'Small Step', icon: TrendUp, size: 16, barWidth: 'w-1/4' },
                    { value: 'milestone', label: 'Milestone', icon: Star, size: 20, barWidth: 'w-1/2' },
                    { value: 'big_win', label: 'Big Win', icon: Trophy, size: 24, barWidth: 'w-full' }
                  ].map((level) => {
                    const Icon = level.icon;
                    const isSelected = impactLevel === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setImpactLevel(level.value)}
                        className={`flex-1 relative overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                          isSelected 
                            ? 'border-primary bg-primary/10 scale-105' 
                            : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <div className="p-3 flex flex-col items-center gap-2">
                          <Icon 
                            size={level.size} 
                            className={`transition-all duration-300 ${
                              isSelected ? 'text-primary animate-pulse' : 'text-muted-foreground'
                            }`} 
                          />
                          <span className={`text-xs font-medium transition-colors duration-300 ${
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                          }`}>
                            {level.label}
                          </span>
                        </div>
                        
                        {/* Animated progress bar */}
                        <div className="absolute bottom-0 left-0 w-full bg-muted/20 h-2">
                          <div 
                            className={`h-full bg-gradient-to-r from-muted-foreground/40 to-muted-foreground/60 transition-all duration-500 ${
                              isSelected ? `${level.barWidth} opacity-100` : 'w-0 opacity-30'
                            }`}
                          />
                        </div>
                        
                        {/* Subtle glow effect for selected item */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Visual impact indicator */}
                <div className="flex items-center justify-center gap-1">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`rounded-full transition-all duration-300 ${
                        (impactLevel === 'small_step' && step === 1) ||
                        (impactLevel === 'milestone' && step <= 2) ||
                        (impactLevel === 'big_win' && step <= 3)
                          ? 'bg-gradient-to-r from-primary to-accent w-3 h-3 animate-scale-in'
                          : 'bg-muted w-2 h-2'
                      }`}
                    />
                  ))}
                </div>
                
                {/* Big Win Yearly Limit - Only show in create mode */}
                {!isEditMode && impactLevel === 'big_win' && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      You can only have 5 big wins per year to keep it real • <span className="text-primary font-medium">{bigWinsCount}/5 used this year</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

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
            disabled={isLoading || !text.trim() || !category || (!isEditMode && !activeSubscription && !freePlanStatus.canAddFortune)}
            className={isEditMode ? "w-full" : "luxury-button w-full"}
          >
            {!isEditMode && !activeSubscription && !freePlanStatus.canAddFortune ? (
              <div className="flex items-center gap-2">
                <Lock size={18} />
                Daily Limit Reached
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isEditMode ? 'Updating...' : 'Tracking...'}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Plus size={18} />
                {isEditMode ? 'Update Fortune' : 'Track Fortune'}
              </div>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};