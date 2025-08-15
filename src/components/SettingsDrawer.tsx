import { useState } from 'react';
import { X, Moon, Sun, Download, Upload, SignOut, Tag } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { CategoryManagerModal } from './CategoryManagerModal';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDrawer = ({ isOpen, onClose }: SettingsDrawerProps) => {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const isDarkMode = theme === 'dark';

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Signed out successfully",
      });
    }
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    toast({
      title: "Coming Soon",
      description: "Export functionality will be available soon",
    });
  };

  const handleImport = () => {
    // TODO: Implement import functionality
    toast({
      title: "Coming Soon", 
      description: "Import functionality will be available soon",
    });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Drawer */}
      <div className={`
        fixed top-0 right-0 h-full w-full sm:w-80 bg-card luxury-card z-50 
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-heading font-semibold">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Theme</h3>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                  <span>Dark Mode</span>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Categories</h3>
              <Button
                variant="outline"
                onClick={() => setShowCategoryManager(true)}
                className="w-full justify-start"
              >
                <Tag size={18} className="mr-2" />
                Manage Categories
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Data</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="w-full justify-start"
                >
                  <Download size={18} className="mr-2" />
                  Export Data
                </Button>
                <Button
                  variant="outline"
                  onClick={handleImport}
                  className="w-full justify-start"
                >
                  <Upload size={18} className="mr-2" />
                  Import Data
                </Button>
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="w-full justify-start"
              >
                <SignOut size={18} className="mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Category Manager Modal */}
      <CategoryManagerModal 
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
      />
    </>
  );
};