import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';

interface BodyStepProps {
  data: { 
    dream_quality: number;
    sexual_appetite: number;
  };
  updateData: (updates: any) => void;
}

const getEnergyLabel = (value: number) => {
  switch (value) {
    case 1: return 'Very Low';
    case 2: return 'Low';
    case 3: return 'Normal';
    case 4: return 'High';
    case 5: return 'Very High';
    default: return 'Normal';
  }
};

const getSleepLabel = (value: number) => {
  switch (value) {
    case 1: return 'Terrible';
    case 2: return 'Poor';
    case 3: return 'Okay';
    case 4: return 'Good';
    case 5: return 'Excellent';
    default: return 'Okay';
  }
};

export const BodyStep = ({ data, updateData }: BodyStepProps) => {
  return (
    <div className="space-y-8">
      <p className="text-center text-muted-foreground">
        How are your energy and sleep quality today?
      </p>
      
      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="text-base font-medium">Sleep Quality</Label>
            <span className="text-sm font-medium text-primary">
              {getSleepLabel(data.dream_quality)}
            </span>
          </div>
          <Slider
            value={[data.dream_quality]}
            onValueChange={(value) => updateData({ dream_quality: value[0] })}
            max={5}
            min={1}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Terrible</span>
            <span>Poor</span>
            <span>Okay</span>
            <span>Good</span>
            <span>Excellent</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="text-base font-medium">Energy Level</Label>
            <span className="text-sm font-medium text-primary">
              {getEnergyLabel(data.sexual_appetite)}
            </span>
          </div>
          <Slider
            value={[data.sexual_appetite]}
            onValueChange={(value) => updateData({ sexual_appetite: value[0] })}
            max={5}
            min={1}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Very Low</span>
            <span>Low</span>
            <span>Normal</span>
            <span>High</span>
            <span>Very High</span>
          </div>
        </div>
      </Card>
    </div>
  );
};