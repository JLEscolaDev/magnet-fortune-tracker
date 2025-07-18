import { useState } from 'react';
import { ArrowLeft, Moon, Sun, Bell, SpeakerSimpleHigh, SpeakerSimpleSlash, Upload, Camera, SignOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CategoryManager } from '@/components/CategoryManager';

interface SettingsPageProps {
  onBack: () => void;
}

export const SettingsPage = ({ onBack }: SettingsPageProps) => {
  const [darkMode, setDarkMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const { toast } = useToast();

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

  const handleAvatarUpload = () => {
    toast({
      title: "Coming Soon",
      description: "Avatar upload functionality will be available soon",
    });
  };

  const handleGenerateAvatar = () => {
    toast({
      title: "Coming Soon",
      description: "AI avatar generation will be available soon",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-heading font-bold">Settings</h1>
        </div>

        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Avatar</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold to-emerald flex items-center justify-center text-2xl">
                🎯
              </div>
              <div className="flex-1">
                <p className="font-medium">Fortune Seeker</p>
                <p className="text-sm text-muted-foreground">Level 1</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleAvatarUpload}
                className="flex-1"
              >
                <Upload size={16} className="mr-2" />
                Upload
              </Button>
              <Button 
                variant="outline" 
                onClick={handleGenerateAvatar}
                className="flex-1"
              >
                <Camera size={16} className="mr-2" />
                Generate AI
              </Button>
            </div>
          </div>

          {/* Preferences */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {darkMode ? <Moon size={20} /> : <Sun size={20} />}
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">Use dark theme</p>
                  </div>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {soundEnabled ? <SpeakerSimpleHigh size={20} /> : <SpeakerSimpleSlash size={20} />}
                  <div>
                    <p className="font-medium">Sound Effects</p>
                    <p className="text-sm text-muted-foreground">Play audio feedback</p>
                  </div>
                </div>
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell size={20} />
                  <div>
                    <p className="font-medium">Animations</p>
                    <p className="text-sm text-muted-foreground">Enable visual effects</p>
                  </div>
                </div>
                <Switch
                  checked={animationsEnabled}
                  onCheckedChange={setAnimationsEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell size={20} />
                  <div>
                    <p className="font-medium">Haptic Feedback</p>
                    <p className="text-sm text-muted-foreground">Vibration on actions</p>
                  </div>
                </div>
                <Switch
                  checked={hapticsEnabled}
                  onCheckedChange={setHapticsEnabled}
                />
              </div>
            </div>
          </div>

          {/* Currency */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Currency</h3>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="JPY">JPY (¥)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category Manager */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Categories</h3>
            <Button 
              variant="outline" 
              onClick={() => setShowCategoryManager(prev => !prev)}
              className="w-full justify-start"
            >
              {showCategoryManager ? 'Hide Categories' : 'Manage Categories'}
            </Button>
            {showCategoryManager && (
              <div className="mt-4 transition-all duration-300">
                <CategoryManager onCategoriesChange={() => setShowCategoryManager(false)} />
              </div>
            )}
          </div>

          {/* Account */}
          <div className="luxury-card p-6">
            <h3 className="text-lg font-heading font-medium mb-4">Account</h3>
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
  );
};