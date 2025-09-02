import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, Brain, Utensils, Activity, Heart, Stethoscope,
  Smile, Frown, Meh, Angry, Laugh, Zap, 
  Skull, HeartHandshake, Target, Users, Briefcase,
  Dumbbell, Bike, TreePine, Circle, Clock, Flame,
  Coffee, Home, Car, Plane, Book, Music,
  ShoppingCart, Banknote, Eye, Ear, Plus,
  ArrowUp, ArrowDown, Minus, Sparkles, AlertTriangle,
  CloudRain, Sun, Thermometer, Shield, Bath,
  Waves, Mountain, Volleyball, Gamepad2, Baby
} from 'lucide-react';
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
  moods: string[];
  mood_causes: string[];
  pain_types: string[];
  exercise_types: string[];
  exercise_duration?: number;
  sexual_appetite: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

const MOOD_OPTIONS = [
  { value: 'happy', label: 'Happy', icon: Smile },
  { value: 'sad', label: 'Sad', icon: Frown },
  { value: 'neutral', label: 'Neutral', icon: Meh },
  { value: 'angry', label: 'Angry', icon: Angry },
  { value: 'excited', label: 'Excited', icon: Laugh },
  { value: 'anxious', label: 'Anxious', icon: Zap },
  { value: 'nervous', label: 'Nervous', icon: AlertTriangle },
  { value: 'frustrated', label: 'Frustrated', icon: Target },
  { value: 'stressed', label: 'Stressed', icon: Brain },
  { value: 'overwhelmed', label: 'Overwhelmed', icon: CloudRain },
  { value: 'content', label: 'Content', icon: Sun },
  { value: 'grateful', label: 'Grateful', icon: HeartHandshake },
  { value: 'energetic', label: 'Energetic', icon: Sparkles },
  { value: 'calm', label: 'Calm', icon: TreePine },
  { value: 'lonely', label: 'Lonely', icon: Home },
  { value: 'confident', label: 'Confident', icon: Shield },
];

const MOOD_CAUSES = [
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'family', label: 'Family', icon: HeartHandshake },
  { value: 'friends', label: 'Friends', icon: Users },
  { value: 'health', label: 'Health', icon: Stethoscope },
  { value: 'money', label: 'Money', icon: Banknote },
  { value: 'relationship', label: 'Relationship', icon: Heart },
  { value: 'school', label: 'School/Studies', icon: Book },
  { value: 'travel', label: 'Travel', icon: Plane },
  { value: 'weather', label: 'Weather', icon: CloudRain },
  { value: 'sleep', label: 'Sleep', icon: Brain },
  { value: 'social', label: 'Social Events', icon: Users },
  { value: 'exercise', label: 'Exercise', icon: Activity },
  { value: 'hobby', label: 'Hobbies', icon: Music },
  { value: 'home', label: 'Home Life', icon: Home },
  { value: 'other', label: 'Other', icon: Plus },
];

const PAIN_TYPES = [
  { value: 'headache', label: 'Headache', icon: Brain },
  { value: 'stomach', label: 'Stomach Pain', icon: Utensils },
  { value: 'back', label: 'Back Pain', icon: Activity },
  { value: 'knee', label: 'Knee Pain', icon: Activity },
  { value: 'neck', label: 'Neck Pain', icon: AlertTriangle },
  { value: 'shoulder', label: 'Shoulder Pain', icon: Activity },
  { value: 'muscle', label: 'Muscle Pain', icon: Dumbbell },
  { value: 'joint', label: 'Joint Pain', icon: Target },
  { value: 'chest', label: 'Chest Pain', icon: Heart },
  { value: 'throat', label: 'Sore Throat', icon: Thermometer },
  { value: 'cold', label: 'Cold/Flu', icon: CloudRain },
  { value: 'fever', label: 'Fever', icon: Thermometer },
  { value: 'nausea', label: 'Nausea', icon: Utensils },
  { value: 'dizzy', label: 'Dizzy', icon: Brain },
  { value: 'tired', label: 'Tired/Fatigue', icon: Meh },
  { value: 'sick', label: 'General Illness', icon: Skull },
];

const EXERCISE_TYPES = [
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'running', label: 'Running', icon: Activity },
  { value: 'cycling', label: 'Cycling', icon: Bike },
  { value: 'yoga', label: 'Yoga', icon: TreePine },
  { value: 'fitness_class', label: 'Fitness Class', icon: Users },
  { value: 'football', label: 'Football', icon: Circle },
  { value: 'tennis', label: 'Tennis', icon: Target },
  { value: 'padel', label: 'Padel', icon: Target },
  { value: 'golf', label: 'Golf', icon: Target },
  { value: 'swimming', label: 'Swimming', icon: Waves },
  { value: 'basketball', label: 'Basketball', icon: Circle },
  { value: 'volleyball', label: 'Volleyball', icon: Volleyball },
  { value: 'hiking', label: 'Hiking', icon: Mountain },
  { value: 'pilates', label: 'Pilates', icon: TreePine },
  { value: 'boxing', label: 'Boxing', icon: Target },
  { value: 'crossfit', label: 'CrossFit', icon: Dumbbell },
  { value: 'martial_arts', label: 'Martial Arts', icon: Target },
  { value: 'dance', label: 'Dance', icon: Music },
  { value: 'climbing', label: 'Climbing', icon: Mountain },
  { value: 'skating', label: 'Skating', icon: Activity },
  { value: 'surfing', label: 'Surfing', icon: Waves },
  { value: 'skiing', label: 'Skiing', icon: Mountain },
  { value: 'walking', label: 'Walking', icon: Activity },
  { value: 'stretching', label: 'Stretching', icon: TreePine },
];

const SEXUAL_APPETITE_OPTIONS = [
  { value: 'none', label: 'None', icon: Minus },
  { value: 'little', label: 'A little', icon: ArrowDown },
  { value: 'some', label: 'Some', icon: Heart },
  { value: 'beast', label: "I'm a beast!", icon: Flame },
];

// Map new mood values to database-compatible values
const mapMoodToDatabase = (mood: string): string => {
  const moodMapping: Record<string, string> = {
    // Positive moods
    'happy': 'very_good',
    'excited': 'very_good',
    'grateful': 'very_good',
    'energetic': 'very_good',
    'confident': 'very_good',
    'content': 'good',
    'calm': 'good',
    
    // Neutral
    'neutral': 'neutral',
    
    // Negative moods
    'sad': 'bad',
    'frustrated': 'bad',
    'lonely': 'bad',
    'anxious': 'bad',
    'nervous': 'bad',
    
    // Very negative
    'angry': 'very_bad',
    'stressed': 'very_bad',
    'overwhelmed': 'very_bad'
  };
  
  return moodMapping[mood] || 'neutral';
};

export const LifestyleTrackerTab = () => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entry, setEntry] = useState<DailyEntry>({
    date: format(new Date(), 'yyyy-MM-dd'),
    dream_quality: 5,
    dream_description: '',
    meals: '',
    alcohol_consumption: 0,
    moods: [],
    mood_causes: [],
    pain_types: [],
    exercise_types: [],
    exercise_duration: 0,
    sexual_appetite: 'some',
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
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Query the lifestyle_entries table
      const { data, error } = await supabase
        .from('lifestyle_entries')
        .select('*')
        .eq('date', dateStr)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Parse mood data from notes field
        let parsedMoodData = { moods: [], mood_causes: [], pain_types: [] };
        let cleanNotes = data.notes || '';
        
        if (data.notes && data.notes.includes('[MOOD_DATA]')) {
          const moodDataMatch = data.notes.match(/\[MOOD_DATA\](.*?)\[\/MOOD_DATA\]/);
          if (moodDataMatch) {
            try {
              parsedMoodData = JSON.parse(moodDataMatch[1]);
              cleanNotes = data.notes.replace(/\[MOOD_DATA\].*?\[\/MOOD_DATA\]/, '').trim();
            } catch (e) {
              console.error('Error parsing mood data:', e);
            }
          }
        }
        
        // Parse stored data and adapt to our interface
        setEntry({
          ...data,
          moods: parsedMoodData.moods || (data.mood ? [data.mood] : []),
          mood_causes: parsedMoodData.mood_causes || [],
          pain_types: parsedMoodData.pain_types || [],
          exercise_types: data.exercise_type ? data.exercise_type.split(',').filter(Boolean) : [],
          sexual_appetite: typeof data.sexual_appetite === 'number' ? 
            (data.sexual_appetite <= 1 ? 'none' : 
             data.sexual_appetite <= 3 ? 'little' :
             data.sexual_appetite <= 5 ? 'some' : 'beast') : 
            (data.sexual_appetite || 'some'),
          notes: cleanNotes
        });
      } else {
        // Reset to default entry for new date
        setEntry({
          date: dateStr,
          dream_quality: 5,
          dream_description: '',
          meals: '',
          alcohol_consumption: 0,
          moods: [],
          mood_causes: [],
          pain_types: [],
          exercise_types: [],
          exercise_duration: 0,
          sexual_appetite: 'some',
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

      // Combine mood data into notes field since database doesn't support arrays
      const moodData = {
        moods: entry.moods,
        mood_causes: entry.mood_causes,
        pain_types: entry.pain_types
      };
      
      const combinedNotes = entry.notes ? 
        `${entry.notes}\n\n[MOOD_DATA]${JSON.stringify(moodData)}[/MOOD_DATA]` :
        `[MOOD_DATA]${JSON.stringify(moodData)}[/MOOD_DATA]`;

      const entryData = {
        user_id: user.id,
        date: entry.date,
        dream_quality: entry.dream_quality,
        dream_description: entry.dream_description,
        meals: entry.meals,
        alcohol_consumption: entry.alcohol_consumption,
        mood: entry.moods.length > 0 ? mapMoodToDatabase(entry.moods[0]) : 'neutral',
        sickness_level: entry.pain_types.length,
        exercise_type: entry.exercise_types.join(','),
        exercise_duration: entry.exercise_duration || 0,
        sexual_appetite: entry.sexual_appetite === 'none' ? 1 : 
                        entry.sexual_appetite === 'little' ? 3 :
                        entry.sexual_appetite === 'some' ? 5 : 10,
        notes: combinedNotes
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

  const toggleArrayValue = (field: keyof DailyEntry, value: string) => {
    const currentArray = entry[field] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateEntry(field, newArray);
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
          Track your daily habits and lifestyle patterns. You can navigate to any date to view or edit previous entries.
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

      {/* Mood & Health */}
      <Card className="p-6">
        <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
          <Stethoscope className="text-primary" size={20} />
          Mood & Health
        </h4>
        <div className="space-y-6">
          <div>
            <Label className="mb-3 block">How are you feeling? (Select multiple)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {MOOD_OPTIONS.map(mood => {
                const Icon = mood.icon;
                return (
                  <Button
                    key={mood.value}
                    variant={entry.moods.includes(mood.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayValue('moods', mood.value)}
                    className="justify-start gap-2 h-auto py-3"
                  >
                    <Icon size={16} />
                    {mood.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {entry.moods.length > 0 && (
            <div>
              <Label className="mb-3 block">What's causing these feelings?</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {MOOD_CAUSES.map(cause => {
                  const Icon = cause.icon;
                  return (
                    <Button
                      key={cause.value}
                      variant={entry.mood_causes.includes(cause.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleArrayValue('mood_causes', cause.value)}
                      className="justify-start gap-2 h-auto py-3"
                    >
                      <Icon size={16} />
                      {cause.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label className="mb-3 block">Any pain or discomfort?</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PAIN_TYPES.map(pain => {
                const Icon = pain.icon;
                return (
                  <Button
                    key={pain.value}
                    variant={entry.pain_types.includes(pain.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayValue('pain_types', pain.value)}
                    className="justify-start gap-2 h-auto py-3"
                  >
                    <Icon size={16} />
                    {pain.label}
                  </Button>
                );
              })}
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
            <Label className="mb-3 block">What activities did you do? (Select multiple)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {EXERCISE_TYPES.map(exercise => {
                const Icon = exercise.icon;
                return (
                  <Button
                    key={exercise.value}
                    variant={entry.exercise_types.includes(exercise.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayValue('exercise_types', exercise.value)}
                    className="justify-start gap-2 h-auto py-3"
                  >
                    <Icon size={16} />
                    {exercise.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Total Duration (minutes)</Label>
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
            <Label className="mb-3 block">Sexual Appetite</Label>
            <div className="grid grid-cols-4 gap-2">
              {SEXUAL_APPETITE_OPTIONS.map(option => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.value}
                    variant={entry.sexual_appetite === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateEntry('sexual_appetite', option.value)}
                    className="flex-col gap-2 h-auto py-4 px-3"
                  >
                    <Icon size={18} />
                    <span className="text-xs text-center leading-tight">{option.label}</span>
                  </Button>
                );
              })}
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