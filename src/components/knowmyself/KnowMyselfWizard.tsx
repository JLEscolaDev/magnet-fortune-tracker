import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { MoodStep } from './MoodStep';
import { BodyStep } from './BodyStep';
import { SymptomsStep } from './SymptomsStep';
import { NotesStep } from './NotesStep';

interface WizardData {
  date: string;
  // Step 1: Mood (must be 1-5 for DB constraint)
  mood: number | null;
  
  // Step 2: Body metrics
  dream_quality: number;
  sexual_appetite: number;
  
  // Step 3: Symptoms/Issues
  moods: string[];
  mood_causes: string[];
  pain_types: string[];
  exercise_types: string[];
  exercise_duration: number;
  alcohol_consumption: number;
  
  // Step 4: Notes
  meals: string;
  dream_description: string;
  notes: string;
}

const STEPS = [
  { id: 'mood', title: 'How are you feeling?', component: MoodStep },
  { id: 'body', title: 'Energy & Sleep', component: BodyStep },
  { id: 'symptoms', title: 'Body & Activities', component: SymptomsStep },
  { id: 'notes', title: 'Additional Details', component: NotesStep },
];

interface KnowMyselfWizardProps {
  selectedDate: Date;
  onClose?: () => void;
}

export const KnowMyselfWizard = ({ selectedDate, onClose }: KnowMyselfWizardProps) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [data, setData] = useState<WizardData>({
    date: format(selectedDate, 'yyyy-MM-dd'),
    mood: null,
    dream_quality: 3,
    sexual_appetite: 3,
    moods: [],
    mood_causes: [],
    pain_types: [],
    exercise_types: [],
    exercise_duration: 0,
    alcohol_consumption: 0,
    meals: '',
    dream_description: '',
    notes: ''
  });

  useEffect(() => {
    loadExistingData();
  }, [selectedDate]);

  const loadExistingData = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: existingEntry, error } = await supabase
        .from('lifestyle_entries')
        .select('*')
        .eq('date', dateStr)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (existingEntry) {
        // Parse mood data from notes field
        let parsedMoodData = { moods: [], mood_causes: [], pain_types: [] };
        let cleanNotes = existingEntry.notes || '';
        let cleanMeals = '';
        
        if (existingEntry.notes && existingEntry.notes.includes('[MOOD_DATA]')) {
          const moodDataMatch = existingEntry.notes.match(/\[MOOD_DATA\](.*?)\[\/MOOD_DATA\]/);
          if (moodDataMatch) {
            try {
              parsedMoodData = JSON.parse(moodDataMatch[1]);
              cleanNotes = existingEntry.notes.replace(/\[MOOD_DATA\].*?\[\/MOOD_DATA\]/, '').trim();
            } catch (e) {
              console.error('Error parsing mood data:', e);
            }
          }
        }

        // Map database mood to number (1-5)
        const moodMapping: Record<string, number> = {
          'very_bad': 1,
          'bad': 2,
          'neutral': 3,
          'good': 4,
          'very_good': 5
        };

        setData({
          date: dateStr,
          mood: existingEntry.mood ? (moodMapping[existingEntry.mood] || 3) : null,
          dream_quality: existingEntry.dream_quality || 3,
          sexual_appetite: existingEntry.sexual_appetite || 3,
          moods: parsedMoodData.moods || [],
          mood_causes: parsedMoodData.mood_causes || [],
          pain_types: parsedMoodData.pain_types || [],
          exercise_types: existingEntry.exercise_type ? existingEntry.exercise_type.split(',').filter(Boolean) : [],
          exercise_duration: existingEntry.exercise_duration || 0,
          alcohol_consumption: existingEntry.alcohol_consumption || 0,
          meals: existingEntry.meals || '',
          dream_description: existingEntry.dream_description || '',
          notes: cleanNotes
        });
      } else {
        // Reset to defaults for new date
        setData({
          date: dateStr,
          mood: null,
          dream_quality: 3,
          sexual_appetite: 3,
          moods: [],
          mood_causes: [],
          pain_types: [],
          exercise_types: [],
          exercise_duration: 0,
          alcohol_consumption: 0,
          meals: '',
          dream_description: '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error loading entry:', error);
      toast({
        title: "Error",
        description: "Failed to load existing data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateData = (updates: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 0: // Mood step
        return data.mood !== null && data.mood >= 1 && data.mood <= 5;
      case 1: // Body step
        return data.dream_quality >= 1 && data.dream_quality <= 5 && 
               data.sexual_appetite >= 1 && data.sexual_appetite <= 5;
      case 2: // Symptoms step
        return true; // Optional data
      case 3: // Notes step
        return true; // Optional data
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Map mood number back to string for database
      const moodMapping: Record<number, string> = {
        1: 'very_bad',
        2: 'bad', 
        3: 'neutral',
        4: 'good',
        5: 'very_good'
      };

      // Combine mood data into notes field
      const moodData = {
        moods: data.moods,
        mood_causes: data.mood_causes,
        pain_types: data.pain_types
      };
      
      const combinedNotes = data.notes ? 
        `${data.notes}\n\n[MOOD_DATA]${JSON.stringify(moodData)}[/MOOD_DATA]` :
        `[MOOD_DATA]${JSON.stringify(moodData)}[/MOOD_DATA]`;

      const entryData = {
        user_id: user.id,
        date: data.date,
        mood: data.mood ? moodMapping[data.mood] : 'neutral',
        dream_quality: data.dream_quality,
        dream_description: data.dream_description,
        meals: data.meals,
        alcohol_consumption: data.alcohol_consumption,
        sickness_level: data.pain_types.length,
        exercise_type: data.exercise_types.join(','),
        exercise_duration: data.exercise_duration,
        sexual_appetite: data.sexual_appetite,
        notes: combinedNotes
      };

      const { error } = await supabase
        .from('lifestyle_entries')
        .upsert(entryData, { 
          onConflict: 'user_id,date',
          ignoreDuplicates: false 
        });

      if (error) {
        // Check for constraint violation
        if (error.code === '23514' || error.message.includes('mood') || error.message.includes('constraint')) {
          toast({
            title: "Value out of range",
            description: "Mood must be 1–5. Please check your selection.",
            variant: "destructive"
          });
          setCurrentStep(0); // Go back to mood step
          return;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Your daily entry has been saved"
      });
      
      // Reset wizard to first step
      setCurrentStep(0);
    } catch (error) {
      console.error('Error saving entry:', error);
      toast({
        title: "Error", 
        description: "Failed to save your entry",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const CurrentStepComponent = STEPS[currentStep].component;
  const isLastStep = currentStep === STEPS.length - 1;
  const canProceed = canProceedFromStep(currentStep);

  return (
    <div className="max-w-sm mx-auto min-h-screen md:min-h-0 relative">
      {/* Close button */}
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      <Card className="h-full md:h-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-xl font-heading font-medium text-center mb-4">
            {STEPS[currentStep].title}
          </h2>
          
          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1">
          <CurrentStepComponent data={data} updateData={updateData} />
        </div>

        {/* Navigation */}
        <div className="p-6 border-t">
          <div className="flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex-1 max-w-24"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={!canProceed || saving}
              className="flex-1"
            >
              {saving ? (
                'Saving...'
              ) : isLastStep ? (
                'Save Entry'
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
          
          {!canProceed && currentStep === 0 && (
            <p className="text-sm text-destructive text-center mt-2">
              Please select how you're feeling to continue
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};