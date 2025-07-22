import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fortune, FortuneCategory, CategoryData } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface EditFortuneModalProps {
  isOpen: boolean;
  onClose: () => void;
  fortune: Fortune | null;
  onFortuneUpdated: () => void;
}

const defaultCategories: CategoryData[] = [
  { name: 'Wealth', color: '#FFD700', hasNumericValue: true },
  { name: 'Health', color: '#FF6B6B', hasNumericValue: false },
  { name: 'Love', color: '#FF69B4', hasNumericValue: false },
  { name: 'Opportunity', color: '#50C878', hasNumericValue: false },
];

export const EditFortuneModal = ({ isOpen, onClose, fortune, onFortuneUpdated }: EditFortuneModalProps) => {
  const [fortuneText, setFortuneText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FortuneCategory>('Wealth');
  const [fortuneValue, setFortuneValue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryData[]>(defaultCategories);
  const { toast } = useToast();

  useEffect(() => {
    if (fortune && isOpen) {
      setFortuneText(fortune.text);
      setSelectedCategory(fortune.category as FortuneCategory);
      setFortuneValue(fortune.fortune_value ? Number(fortune.fortune_value) : null);
    }
  }, [fortune, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadCustomCategories();
    }
  }, [isOpen]);

  const loadCustomCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: customCategories } = await supabase
        .from('custom_categories')
        .select('*')
        .eq('user_id', user.id);

      if (customCategories) {
        const allCategories = [
          ...defaultCategories,
          ...customCategories.map(cat => ({
            name: cat.name,
            color: cat.color,
            hasNumericValue: cat.has_numeric_value
          }))
        ];
        setCategories(allCategories);
      }
    } catch (error) {
      console.error('Error loading custom categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fortune || !fortuneText.trim() || !selectedCategory) return;
    
    setIsLoading(true);
    
    try {
      const selectedCategoryData = categories.find(cat => cat.name === selectedCategory);
      const updateData: any = {
        text: fortuneText.trim(),
        category: selectedCategory,
      };

      // Only include fortune_value if the category supports numeric values
      if (selectedCategoryData?.hasNumericValue) {
        updateData.fortune_value = fortuneValue;
      } else {
        updateData.fortune_value = null;
      }

      const { error } = await supabase
        .from('fortunes')
        .update(updateData)
        .eq('id', fortune.id);

      if (error) throw error;

      toast({
        title: "Fortune updated successfully!",
        description: "Your fortune has been updated.",
      });

      onFortuneUpdated();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error updating fortune:', error);
      toast({
        title: "Error updating fortune",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFortuneText('');
    setSelectedCategory('Wealth');
    setFortuneValue(null);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const selectedCategoryData = categories.find(cat => cat.name === selectedCategory);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Fortune</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Fortune Text</label>
            <Textarea
              value={fortuneText}
              onChange={(e) => setFortuneText(e.target.value)}
              placeholder="Describe your fortune..."
              className="min-h-20"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as FortuneCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.name} value={category.name}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCategoryData?.hasNumericValue && (
            <div>
              <label className="text-sm font-medium mb-2 block">Value (optional)</label>
              <Input
                type="number"
                step="0.01"
                value={fortuneValue || ''}
                onChange={(e) => setFortuneValue(e.target.value ? Number(e.target.value) : null)}
                placeholder="Enter monetary value..."
              />
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !fortuneText.trim() || !selectedCategory} className="flex-1">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Fortune
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};