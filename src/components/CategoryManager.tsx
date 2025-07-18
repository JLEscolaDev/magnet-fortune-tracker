import { useState, useEffect } from 'react';
import { Plus, X, Pencil, CurrencyDollar } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CustomCategory {
  id: string;
  name: string;
  hasNumericValue: boolean;
  color: string;
  user_id: string;
}

interface CategoryManagerProps {
  onCategoriesChange: (categories: string[]) => void;
}

export const CategoryManager = ({ onCategoriesChange }: CategoryManagerProps) => {
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryHasValue, setNewCategoryHasValue] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const defaultCategories = ['Wealth', 'Health', 'Love', 'Opportunity', 'Other'];

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('custom_categories')
        .select('*')
        .eq('user_id', user.id);

      if (data) {
        setCategories(data);
        const allCategories = [...defaultCategories, ...data.map(cat => cat.name)];
        onCategoriesChange(allCategories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('custom_categories')
        .insert([
          {
            name: newCategoryName.trim(),
            has_numeric_value: newCategoryHasValue,
            color: '#D6B94C',
            user_id: user.id
          }
        ]);

      if (error) throw error;

      toast({
        title: "Category Added",
        description: `"${newCategoryName}" has been added to your categories`,
      });

      setNewCategoryName('');
      setNewCategoryHasValue(false);
      setIsAddingNew(false);
      fetchCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: "Error",
        description: "Failed to add category",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('custom_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Category Deleted",
        description: `"${name}" has been removed`,
      });

      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Custom Categories</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddingNew(true)}
          disabled={isAddingNew}
        >
          <Plus size={16} className="mr-1" />
          Add Category
        </Button>
      </div>

      {/* Default Categories */}
      <div className="space-y-2">
        <h5 className="text-sm font-medium text-muted-foreground">Default Categories</h5>
        <div className="flex flex-wrap gap-2">
          {defaultCategories.map((category) => (
            <div
              key={category}
              className="px-3 py-1 bg-muted/30 rounded-full text-sm flex items-center gap-2"
            >
              {category === 'Wealth' && <CurrencyDollar size={14} className="text-gold" />}
              {category}
            </div>
          ))}
        </div>
      </div>

      {/* Custom Categories */}
      {categories.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-muted-foreground">Your Custom Categories</h5>
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="font-medium">{category.name}</span>
                  {category.hasNumericValue && (
                    <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded">
                      Numeric
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteCategory(category.id, category.name)}
                  className="text-destructive hover:text-destructive"
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Category Form */}
      {isAddingNew && (
        <div className="luxury-card p-4 space-y-4">
          <div>
            <Input
              placeholder="Category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="focus:border-gold focus:ring-gold/20"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={newCategoryHasValue}
                onCheckedChange={setNewCategoryHasValue}
              />
              <span className="text-sm">Has numeric value</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleAddCategory}
              disabled={!newCategoryName.trim()}
              className="flex-1"
            >
              Add Category
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingNew(false);
                setNewCategoryName('');
                setNewCategoryHasValue(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};