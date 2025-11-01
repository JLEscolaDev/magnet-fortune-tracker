import { Button } from '@/components/ui/button';
import { Frown, Meh, Smile, SmilePlus, TrendingDown } from 'lucide-react';

interface MoodStepProps {
  data: { mood: number | null };
  updateData: (updates: any) => void;
}

const MOOD_OPTIONS = [
  { value: 1, icon: TrendingDown, label: 'Very Bad' },
  { value: 2, icon: Frown, label: 'Bad' },
  { value: 3, icon: Meh, label: 'Okay' },
  { value: 4, icon: Smile, label: 'Good' },
  { value: 5, icon: SmilePlus, label: 'Great' },
];

export const MoodStep = ({ data, updateData }: MoodStepProps) => {
  const handleMoodSelect = (moodValue: number) => {
    updateData({ mood: moodValue });
  };

  return (
    <div className="space-y-6">
      <p className="text-center" style={{ color: '#BEBEBE' }}>
        Choose the option that best reflects your mindset right now.
      </p>
      
      <div className="grid gap-3">
        {MOOD_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = data.mood === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => handleMoodSelect(option.value)}
              className={`
                h-16 px-6 flex items-center gap-4 rounded-2xl transition-all
                ${isSelected ? 'wellness-card-selected' : 'wellness-card hover:border-[#3D3D3D]'}
              `}
              style={{
                background: isSelected ? 'rgba(200, 169, 77, 0.08)' : 'rgba(20, 20, 20, 0.8)',
              }}
              aria-label={`Select ${option.label} mood`}
            >
              <Icon 
                size={24} 
                style={{ color: '#9A9A9A' }} 
                aria-hidden="true"
              />
              <span 
                className="text-base font-medium"
                style={{ color: '#F3F3F1' }}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};