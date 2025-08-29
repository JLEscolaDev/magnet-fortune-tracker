import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CalendarRange, Clock, Heart, Activity, Brain, Utensils, Wine, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DailyEntry {
  id?: string;
  date: string;
  dream_quality: number;
  dream_description?: string;
  meals: string;
  alcohol_consumption: number;
  mood: string;
  sickness_level: number;
  exercise_type?: string;
  exercise_duration?: number;
  sexual_appetite: number;
  sexual_performance: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const LifestyleTrackerTab = () => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entry, setEntry] = useState<DailyEntry>({
    date: format(new Date(), 'yyyy-MM-dd'),
    dream_quality: 5,
    dream_description: '',
    meals: '',
    alcohol_consumption: 0,
    mood: 'neutral',
    sickness_level: 0,
    exercise_type: '',
    exercise_duration: 0,
    sexual_appetite: 5,
    sexual_performance: 5,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEntryForDate(selectedDate);
  }, [selectedDate]);

  const loadEntryForDate = async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('lifestyle_entries')
        .select('*')
        .eq('date', dateStr)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setEntry(data);
      } else {
        // Reset to default entry for new date
        setEntry({
          date: dateStr,
          dream_quality: 5,
          dream_description: '',
          meals: '',
          alcohol_consumption: 0,
          mood: 'neutral',
          sickness_level: 0,
          exercise_type: '',
          exercise_duration: 0,
          sexual_appetite: 5,
          sexual_performance: 5,
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error loading entry:', error);
      toast({
        title: "Error",
        description: "Failed to load lifestyle entry",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveEntry = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const entryData = {
        ...entry,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('lifestyle_entries')
        .upsert(entryData, { 
          onConflict: 'user_id,date',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lifestyle entry saved successfully"
      });
    } catch (error) {
      console.error('Error saving entry:', error);
      toast({
        title: "Error",
        description: "Failed to save lifestyle entry",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = (field: keyof DailyEntry, value: any) => {
    setEntry(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Card className="p-6 animate-pulse">
          <div className="h-6 bg-muted/30 rounded w-48 mb-4" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-muted/20 rounded" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-24 md:pb-6">
      {/* Date Selection */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-medium flex items-center gap-2">
            <Calendar className="text-gold" size={24} />
            Daily Lifestyle Tracker
          </h3>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="w-40"
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Track your daily habits and lifestyle patterns to improve your overall well-being.
        </p>
      </Card>

      {/* Sleep & Dreams */}
      <Card className="p-6">
        <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
          <Brain className="text-primary" size={20} />
          Sleep & Dreams
        </h4>
        <div className="space-y-4">
          <div>
            <Label>Dream Quality (1-10)</Label>
            <Input
              type="range"
              min="1"
              max="10"
              value={entry.dream_quality}
              onChange={(e) => updateEntry('dream_quality', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center text-sm text-muted-foreground mt-1">
              {entry.dream_quality}/10
            </div>
          </div>
          <div>
            <Label>Dream Description (Optional)</Label>
            <Textarea
              placeholder="Describe your dreams or any notable sleep experiences..."
              value={entry.dream_description}
              onChange={(e) => updateEntry('dream_description', e.target.value)}
              className="min-h-20"
            />
          </div>
        </div>
      </Card>

      {/* Nutrition */}
      <Card className="p-6">
        <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
          <Utensils className="text-primary" size={20} />
          Nutrition
        </h4>
        <div className="space-y-4">
          <div>
            <Label>Meals & Food Intake</Label>
            <Textarea
              placeholder="What did you eat today? Include meals, snacks, and quantities..."
              value={entry.meals}
              onChange={(e) => updateEntry('meals', e.target.value)}
              className="min-h-24"
            />
          </div>
          <div>
            <Label>Alcohol Consumption (drinks)</Label>
            <Input
              type="number"
              min="0"
              max="20"
              value={entry.alcohol_consumption}
              onChange={(e) => updateEntry('alcohol_consumption', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </Card>

      {/* Health & Mood */}
      <Card className="p-6">
        <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
          <Stethoscope className="text-primary" size={20} />
          Health & Mood
        </h4>
        <div className="space-y-4">
          <div>
            <Label>Mood</Label>
            <Select value={entry.mood} onValueChange={(value) => updateEntry('mood', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="very_good">Very Good 😊</SelectItem>
                <SelectItem value="good">Good 🙂</SelectItem>
                <SelectItem value="neutral">Neutral 😐</SelectItem>
                <SelectItem value="bad">Bad 😞</SelectItem>
                <SelectItem value="very_bad">Very Bad 😢</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sickness Level (0-10)</Label>
            <Input
              type="range"
              min="0"
              max="10"
              value={entry.sickness_level}
              onChange={(e) => updateEntry('sickness_level', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center text-sm text-muted-foreground mt-1">
              {entry.sickness_level}/10 {entry.sickness_level === 0 ? '(Healthy)' : '(Sick)'}
            </div>
          </div>
        </div>
      </Card>

      {/* Exercise */}
      <Card className="p-6">
        <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
          <Activity className="text-primary" size={20} />
          Exercise & Physical Activity
        </h4>
        <div className="space-y-4">
          <div>
            <Label>Exercise Type</Label>
            <Input
              placeholder="e.g., Running, Gym, Yoga, Swimming..."
              value={entry.exercise_type}
              onChange={(e) => updateEntry('exercise_type', e.target.value)}
            />
          </div>
          <div>
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min="0"
              max="480"
              value={entry.exercise_duration}
              onChange={(e) => updateEntry('exercise_duration', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </Card>

      {/* Intimate Health */}
      <Card className="p-6">
        <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
          <Heart className="text-primary" size={20} />
          Intimate Health
        </h4>
        <div className="space-y-4">
          <div>
            <Label>Sexual Appetite (1-10)</Label>
            <Input
              type="range"
              min="1"
              max="10"
              value={entry.sexual_appetite}
              onChange={(e) => updateEntry('sexual_appetite', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center text-sm text-muted-foreground mt-1">
              {entry.sexual_appetite}/10
            </div>
          </div>
          <div>
            <Label>Sexual Performance (1-10)</Label>
            <Input
              type="range"
              min="1"
              max="10"
              value={entry.sexual_performance}
              onChange={(e) => updateEntry('sexual_performance', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center text-sm text-muted-foreground mt-1">
              {entry.sexual_performance}/10
            </div>
          </div>
        </div>
      </Card>

      {/* Additional Notes */}
      <Card className="p-6">
        <h4 className="text-md font-semibold mb-4">Additional Notes</h4>
        <Textarea
          placeholder="Any additional thoughts, observations, or notes about your day..."
          value={entry.notes}
          onChange={(e) => updateEntry('notes', e.target.value)}
          className="min-h-24"
        />
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={saveEntry} 
          disabled={saving}
          className="luxury-button min-w-32"
        >
          {saving ? 'Saving...' : 'Save Entry'}
        </Button>
      </div>
    </div>
  );
};