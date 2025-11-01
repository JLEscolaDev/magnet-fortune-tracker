// Updated 2025-11-01
import moodVeryBad from '@/assets/mood-very-bad.png';
import moodBad from '@/assets/mood-bad.png';
import moodOkay from '@/assets/mood-okay.png';
import moodGood from '@/assets/mood-good.png';
import moodGreat from '@/assets/mood-great.png';
interface MoodStepProps {
  data: {
    mood: number | null;
  };
  updateData: (updates: any) => void;
}
const MOOD_OPTIONS = [{
  value: 1,
  icon: moodVeryBad,
  label: 'Very Bad'
}, {
  value: 2,
  icon: moodBad,
  label: 'Bad'
}, {
  value: 3,
  icon: moodOkay,
  label: 'Okay'
}, {
  value: 4,
  icon: moodGood,
  label: 'Good'
}, {
  value: 5,
  icon: moodGreat,
  label: 'Great'
}];
export const MoodStep = ({
  data,
  updateData
}: MoodStepProps) => {
  const handleMoodSelect = (moodValue: number) => {
    updateData({
      mood: moodValue
    });
  };
  return <div className="space-y-4">
      <p className="text-center text-sm" style={{
      color: '#BEBEBE'
    }}>
        Choose the option that best reflects your mindset right now.
      </p>
      
      <div className="space-y-3.5">
        {MOOD_OPTIONS.map(option => {
        const isSelected = data.mood === option.value;
        return <button key={option.value} onClick={() => handleMoodSelect(option.value)} className="w-full h-[68px] px-5 flex items-center gap-4 rounded-[22px] transition-all active:scale-[0.98]" style={{
          background: isSelected ? 'rgba(200, 169, 77, 0.06)' : 'rgba(17, 17, 17, 0.7)',
          border: isSelected ? '1.5px solid #C8A94D' : '1px solid #2D2D2D',
          boxShadow: isSelected ? '0 2px 8px rgba(200, 169, 77, 0.15)' : 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
          transform: isSelected ? 'scale(1.02)' : 'scale(1)'
        }} aria-label={`Select ${option.label} mood`}>
              <img src={option.icon} alt="" style={{
            opacity: 0.8
          }} aria-hidden="true" className="w-[40px] h-[40px] " />
              <span className="text-base font-semibold" style={{
            color: '#F3F3F1'
          }}>
                {option.label}
              </span>
            </button>;
      })}
      </div>
    </div>;
};