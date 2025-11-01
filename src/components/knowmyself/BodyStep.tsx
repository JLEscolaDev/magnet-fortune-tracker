import { Moon, Zap, Heart, Thermometer } from 'lucide-react';

interface BodyStepProps {
  data: { 
    dream_quality: number;
    energy_level: number;
    sexual_appetite: number;
    room_temperature: number;
  };
  updateData: (updates: any) => void;
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
              <div className="flex flex-col items-center mb-4">
                <Icon 
                  size={40} 
                  strokeWidth={1.5}
                  style={{ color: '#9A9A9A', marginBottom: '12px' }} 
                />
                <h3 
                  className="text-sm font-medium mb-2 text-center"
                  style={{ color: '#F3F3F1' }}
                >
                  {metric.title}
                </h3>
                <div className="wellness-value-pill inline-block text-xs px-3 py-1">
                  {metric.valueLabels[currentValue - 1]}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleValueChange(metric.key, value)}
                      className={`wellness-gauge-dot ${
                        currentValue === value ? 'wellness-gauge-dot-active' : ''
                      }`}
                      aria-label={`Set ${metric.title} to ${metric.valueLabels[value - 1]}`}
                    />
                  ))}
                </div>

                <div className="flex justify-between text-[11px]" style={{ color: '#8F8F8F' }}>
                  <span>{metric.labels[0]}</span>
                  <span>{metric.labels[metric.labels.length - 1]}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};