import { Moon, Zap, Heart, Thermometer } from 'lucide-react';

interface BodyStepProps {
  data: { 
    dream_quality: number;
    energy_level: number;
    sexual_appetite: number;
    room_temperature: number;
  };
  updateData: (updates: Partial<BodyStepData>) => void;
}

const METRICS = [
  {
    key: 'dream_quality' as const,
    icon: Moon,
    title: 'Sleep Quality',
    labels: ['Terrible', 'Poor', 'Okay', 'Good', 'Great'],
    valueLabels: ['Terrible', 'Poor', 'Okay', 'Good', 'Great'],
  },
  {
    key: 'energy_level' as const,
    icon: Zap,
    title: 'Energy Level',
    labels: ['Very Low', 'Low', 'Normal', 'High', 'Very High'],
    valueLabels: ['Very Low', 'Low', 'Normal', 'High', 'Very High'],
  },
  {
    key: 'sexual_appetite' as const,
    icon: Heart,
    title: 'Sexual Appetite',
    labels: ['Very Low', 'Low', 'Normal', 'High', 'Very High'],
    valueLabels: ['Very Low', 'Low', 'Normal', 'High', 'Very High'],
  },
  {
    key: 'room_temperature' as const,
    icon: Thermometer,
    title: 'Room Temperature',
    labels: ['Cold', 'Cool', 'Normal', 'Warm', 'Hot'],
    valueLabels: ['Cold', 'Cool', 'Normal', 'Warm', 'Hot'],
  },
];

export const BodyStep = ({ data, updateData }: BodyStepProps) => {
  const handleValueChange = (key: keyof BodyStepProps['data'], value: number) => {
    updateData({ [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {METRICS.map((metric) => {
          const Icon = metric.icon;
          const currentValue = data[metric.key];
          
          return (
            <div
              key={metric.key}
              className="wellness-card p-5 flex flex-col"
              style={{ background: 'rgba(20, 20, 20, 0.8)' }}
            >
              <div className="flex flex-col items-center mb-5">
                <Icon 
                  size={48} 
                  strokeWidth={0}
                  fill="#C8A94D"
                  style={{ color: '#C8A94D', marginBottom: '16px' }} 
                />
                <h3 
                  className="text-base font-medium mb-3 text-center"
                  style={{ color: '#C8A94D', fontFamily: 'serif' }}
                >
                  {metric.title}
                </h3>
                <div 
                  className="inline-block text-xs px-4 py-1.5 rounded-full font-medium"
                  style={{ 
                    background: 'linear-gradient(135deg, #C8A94D, #B88A2C)',
                    color: '#0B0B0C'
                  }}
                >
                  {metric.valueLabels[currentValue - 1]}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-center items-center gap-3">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleValueChange(metric.key, value)}
                      className="transition-all duration-200"
                      style={{
                        width: currentValue === value ? '14px' : '12px',
                        height: currentValue === value ? '14px' : '12px',
                        borderRadius: '50%',
                        background: currentValue === value 
                          ? 'linear-gradient(135deg, #C8A94D, #B88A2C)'
                          : '#3A3A3A',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: currentValue === value ? '0 2px 8px rgba(200, 169, 77, 0.4)' : 'none'
                      }}
                      aria-label={`Set ${metric.title} to ${metric.valueLabels[value - 1]}`}
                    />
                  ))}
                </div>

                <div className="flex justify-between text-[10px] sm:text-[11px] px-1" style={{ color: '#8F8F8F' }}>
                  <span className="whitespace-nowrap text-left flex-1">{metric.labels[0]}</span>
                  <span className="whitespace-nowrap text-right flex-1">{metric.labels[metric.labels.length - 1]}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};