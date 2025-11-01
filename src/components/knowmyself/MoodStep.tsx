// Updated 2025-11-01
import { CircleAlert, CircleMinus, Circle, CircleCheck, Sparkles } from 'lucide-react';

interface MoodStepProps {
  data: { mood: number | null };
  updateData: (updates: any) => void;
}

const MOOD_OPTIONS = [
  { value: 1, icon: CircleAlert, label: 'Very Bad' },
  { value: 2, icon: CircleMinus, label: 'Bad' },
  { value: 3, icon: Circle, label: 'Okay' },
  { value: 4, icon: CircleCheck, label: 'Good' },
  { value: 5, icon: Sparkles, label: 'Great' },
];

export const MoodStep = ({ data, updateData }: MoodStepProps) => {
  const handleMoodSelect = (moodValue: number) => {
    updateData({ mood: moodValue });
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-sm" style={{ color: '#BEBEBE' }}>
        Choose the option that best reflects your mindset right now.
      </p>
      
      <div className="space-y-3.5">
        {MOOD_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = data.mood === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => handleMoodSelect(option.value)}
              className="w-full h-[68px] px-5 flex items-center gap-4 rounded-[22px] transition-all active:scale-[0.98]"
              style={{
                background: isSelected 
                  ? 'rgba(200, 169, 77, 0.06)'
                  : 'rgba(17, 17, 17, 0.7)',
                border: isSelected 
                  ? '1.5px solid #C8A94D'
                  : '1px solid #2D2D2D',
                boxShadow: isSelected 
                  ? '0 2px 8px rgba(200, 169, 77, 0.15)'
                  : 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              }}
              aria-label={`Select ${option.label} mood`}
            >
              <Icon 
                size={26}
                strokeWidth={2.5}
                style={{ 
                  color: '#9A9A9A',
                  flexShrink: 0
                }} 
                aria-hidden="true"
              />
              <span 
                className="text-base font-semibold"
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