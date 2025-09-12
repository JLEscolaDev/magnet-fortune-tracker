import { Button } from '@/components/ui/button';

interface MoodStepProps {
  data: { mood: number | null };
  updateData: (updates: any) => void;
}

const MOOD_OPTIONS = [
  { value: 1, emoji: '😢', label: 'Very Bad', color: 'bg-red-100 border-red-200 hover:bg-red-200 text-red-800' },
  { value: 2, emoji: '😔', label: 'Bad', color: 'bg-orange-100 border-orange-200 hover:bg-orange-200 text-orange-800' },
  { value: 3, emoji: '😐', label: 'Okay', color: 'bg-yellow-100 border-yellow-200 hover:bg-yellow-200 text-yellow-800' },
  { value: 4, emoji: '😊', label: 'Good', color: 'bg-blue-100 border-blue-200 hover:bg-blue-200 text-blue-800' },
  { value: 5, emoji: '😄', label: 'Great', color: 'bg-green-100 border-green-200 hover:bg-green-200 text-green-800' },
];

export const MoodStep = ({ data, updateData }: MoodStepProps) => {
  const handleMoodSelect = (moodValue: number) => {
    updateData({ mood: moodValue });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Choose the option that best describes how you're feeling overall today
      </p>
      
      <div className="grid gap-3">
        {MOOD_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant="outline"
            size="lg"
            onClick={() => handleMoodSelect(option.value)}
            className={`
              h-16 justify-start text-left transition-all
              ${data.mood === option.value 
                ? 'ring-2 ring-primary ring-offset-2 ' + option.color
                : 'hover:' + option.color
              }
            `}
            aria-label={`Select ${option.label} mood`}
          >
            <span className="text-2xl mr-4" aria-hidden="true">
              {option.emoji}
            </span>
            <div>
              <div className="font-medium text-base">{option.label}</div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};