import { useState } from 'react';
import { 
  Brain, AlertTriangle, Meh, Activity,
  Utensils, Skull, Thermometer, Dumbbell,
  Bike, TreePine, Waves, Target, Circle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SymptomsStepProps {
  data: {
    pain_types: string[];
    exercise_types: string[];
    exercise_duration: number;
    alcohol_consumption: number;
  };
  updateData: (updates: Partial<{ moods: string[]; mood_causes: string[]; pain_types: string[]; exercise_types: string[]; exercise_duration: number; alcohol_consumption: number }>) => void;
}

const SYMPTOMS = [
  { value: 'headache', label: 'Headache', icon: Brain },
  { value: 'stress', label: 'Stress', icon: AlertTriangle },
  { value: 'tired', label: 'Tired', icon: Meh },
  { value: 'muscle', label: 'Muscle Pain', icon: Activity },
  { value: 'stomach', label: 'Stomach', icon: Utensils },
  { value: 'back', label: 'Back Pain', icon: Activity },
];

const EXERCISES = [
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'running', label: 'Running', icon: Activity },
  { value: 'yoga', label: 'Yoga', icon: TreePine },
  { value: 'cycling', label: 'Cycling', icon: Bike },
  { value: 'swimming', label: 'Swimming', icon: Waves },
  { value: 'walking', label: 'Walking', icon: Activity },
];

export const SymptomsStep = ({ data, updateData }: SymptomsStepProps) => {
  const [showMoreSymptoms, setShowMoreSymptoms] = useState(false);
  const [showMoreExercises, setShowMoreExercises] = useState(false);

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

  const symptomsCount = data.pain_types?.length || 0;
  const exercisesCount = data.exercise_types?.length || 0;

  return (
    <div className="space-y-8">
      {/* Symptoms */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 style={{ color: '#F3F3F1', fontSize: '16px', fontWeight: 500 }}>
            Any discomfort? (Optional)
          </h3>
          {symptomsCount > 0 && (
            <span className="wellness-value-pill text-xs">
              {symptomsCount}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SYMPTOMS.map((symptom) => {
            const Icon = symptom.icon;
            const isSelected = data.pain_types?.includes(symptom.value);
            return (
              <button
                key={symptom.value}
                onClick={() => toggleSymptom(symptom.value)}
                className="h-[100px] flex flex-col items-center justify-center gap-2 rounded-[18px] transition-all"
                style={{
                  background: isSelected 
                    ? 'rgba(200, 169, 77, 0.08)'
                    : 'rgba(17, 17, 17, 0.8)',
                  border: isSelected 
                    ? '1.5px solid #C8A94D'
                    : '1px solid #2D2D2D',
                }}
                aria-label={`Toggle ${symptom.label}`}
              >
                <Icon size={28} strokeWidth={2} style={{ color: '#9A9A9A' }} />
                <span 
                  className="text-sm font-medium text-center"
                  style={{ color: '#F3F3F1' }}
                >
                  {symptom.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Exercise */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 style={{ color: '#F3F3F1', fontSize: '16px', fontWeight: 500 }}>
            Physical Activities
          </h3>
          {exercisesCount > 0 && (
            <span className="wellness-value-pill text-xs">
              {exercisesCount}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {EXERCISES.map((exercise) => {
            const Icon = exercise.icon;
            const isSelected = data.exercise_types?.includes(exercise.value);
            return (
              <button
                key={exercise.value}
                onClick={() => toggleExercise(exercise.value)}
                className="h-[100px] flex flex-col items-center justify-center gap-2 rounded-[18px] transition-all"
                style={{
                  background: isSelected 
                    ? 'rgba(200, 169, 77, 0.08)'
                    : 'rgba(17, 17, 17, 0.8)',
                  border: isSelected 
                    ? '1.5px solid #C8A94D'
                    : '1px solid #2D2D2D',
                }}
                aria-label={`Toggle ${exercise.label}`}
              >
                <Icon size={28} strokeWidth={2} style={{ color: '#9A9A9A' }} />
                <span 
                  className="text-sm font-medium text-center"
                  style={{ color: '#F3F3F1' }}
                >
                  {exercise.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration and alcohol */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <Label style={{ color: '#BEBEBE' }} className="text-xs font-medium">
            Exercise (min)
          </Label>
          <Input
            type="number"
            min="0"
            max="480"
            value={data.exercise_duration}
            onChange={(e) => updateData({ exercise_duration: parseInt(e.target.value) || 0 })}
            className="text-center h-12 rounded-xl border-[#2D2D2D] focus:border-[#C8A94D] transition-colors"
            style={{ 
              background: 'rgba(20, 20, 20, 0.8)',
              color: '#F3F3F1'
            }}
          />
        </div>
        <div className="space-y-2">
          <Label style={{ color: '#BEBEBE' }} className="text-xs font-medium">
            Drinks
          </Label>
          <Input
            type="number"
            min="0"
            max="20"
            value={data.alcohol_consumption}
            onChange={(e) => updateData({ alcohol_consumption: parseInt(e.target.value) || 0 })}
            className="text-center h-12 rounded-xl border-[#2D2D2D] focus:border-[#C8A94D] transition-colors"
            style={{ 
              background: 'rgba(20, 20, 20, 0.8)',
              color: '#F3F3F1'
            }}
          />
        </div>
      </div>
    </div>
  );
};