import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Brain, Activity, Heart, Stethoscope, AlertTriangle,
  Dumbbell, Target, Utensils, Thermometer, CloudRain,
  Skull, Meh, Bike, TreePine, Users, Circle,
  Waves, Mountain, Volleyball, Music, Shield
} from 'lucide-react';

interface SymptomsStepProps {
  data: {
    pain_types: string[];
    exercise_types: string[];
    exercise_duration: number;
    alcohol_consumption: number;
  };
  updateData: (updates: any) => void;
}

const SYMPTOMS = [
  { value: 'headache', label: 'Headache', icon: Brain },
  { value: 'stress', label: 'Stress', icon: AlertTriangle },
  { value: 'tired', label: 'Tired', icon: Meh },
  { value: 'muscle', label: 'Muscle Pain', icon: Dumbbell },
  { value: 'stomach', label: 'Stomach', icon: Utensils },
  { value: 'back', label: 'Back Pain', icon: Activity },
  { value: 'sick', label: 'Feeling Sick', icon: Skull },
  { value: 'fever', label: 'Fever', icon: Thermometer },
];

const EXERCISES = [
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'running', label: 'Running', icon: Activity },
  { value: 'yoga', label: 'Yoga', icon: TreePine },
  { value: 'cycling', label: 'Cycling', icon: Bike },
  { value: 'swimming', label: 'Swimming', icon: Waves },
  { value: 'walking', label: 'Walking', icon: Activity },
  { value: 'tennis', label: 'Tennis', icon: Target },
  { value: 'football', label: 'Football', icon: Circle },
];

export const SymptomsStep = ({ data, updateData }: SymptomsStepProps) => {
  const toggleSymptom = (symptom: string) => {
    const current = data.pain_types || [];
    const updated = current.includes(symptom)
      ? current.filter(s => s !== symptom)
      : [...current, symptom];
    updateData({ pain_types: updated });
  };

  const toggleExercise = (exercise: string) => {
    const current = data.exercise_types || [];
    const updated = current.includes(exercise)
      ? current.filter(e => e !== exercise)
      : [...current, exercise];
    updateData({ exercise_types: updated });
  };

  return (
    <div className="space-y-8">
      <p className="text-center text-muted-foreground">
        Any symptoms or activities today?
      </p>
      
      {/* Symptoms */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Any discomfort? (Optional)</Label>
        <div className="grid grid-cols-2 gap-2">
          {SYMPTOMS.map((symptom) => {
            const Icon = symptom.icon;
            const isSelected = data.pain_types?.includes(symptom.value);
            return (
              <Button
                key={symptom.value}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => toggleSymptom(symptom.value)}
                className="h-12 text-xs flex-col gap-1 p-2"
                aria-label={`Toggle ${symptom.label}`}
              >
                <Icon size={16} />
                <span className="text-center">{symptom.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Exercise */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Physical Activities (Optional)</Label>
        <div className="grid grid-cols-2 gap-2">
          {EXERCISES.map((exercise) => {
            const Icon = exercise.icon;
            const isSelected = data.exercise_types?.includes(exercise.value);
            return (
              <Button
                key={exercise.value}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => toggleExercise(exercise.value)}
                className="h-12 text-xs flex-col gap-1 p-2"
                aria-label={`Toggle ${exercise.label}`}
              >
                <Icon size={16} />
                <span className="text-center">{exercise.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Duration and alcohol */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm">Exercise (min)</Label>
          <Input
            type="number"
            min="0"
            max="480"
            value={data.exercise_duration}
            onChange={(e) => updateData({ exercise_duration: parseInt(e.target.value) || 0 })}
            className="text-center"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Drinks</Label>
          <Input
            type="number"
            min="0"
            max="20"
            value={data.alcohol_consumption}
            onChange={(e) => updateData({ alcohol_consumption: parseInt(e.target.value) || 0 })}
            className="text-center"
          />
        </div>
      </div>
    </div>
  );
};