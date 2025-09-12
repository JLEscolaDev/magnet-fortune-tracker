import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface NotesStepProps {
  data: {
    meals: string;
    dream_description: string;
    notes: string;
  };
  updateData: (updates: any) => void;
}

export const NotesStep = ({ data, updateData }: NotesStepProps) => {
  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Any additional details about your day? (All optional)
      </p>
      
      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium">What did you eat?</Label>
          <Textarea
            placeholder="Breakfast, lunch, dinner, snacks..."
            value={data.meals}
            onChange={(e) => updateData({ meals: e.target.value })}
            className="min-h-16 resize-none"
            maxLength={200}
          />
          <div className="text-xs text-muted-foreground text-right">
            {data.meals.length}/200
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Any dreams or sleep notes?</Label>
          <Textarea
            placeholder="Describe your dreams or sleep quality..."
            value={data.dream_description}
            onChange={(e) => updateData({ dream_description: e.target.value })}
            className="min-h-16 resize-none"
            maxLength={200}
          />
          <div className="text-xs text-muted-foreground text-right">
            {data.dream_description.length}/200
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Other thoughts or observations?</Label>
          <Textarea
            placeholder="Anything else notable about your day..."
            value={data.notes}
            onChange={(e) => updateData({ notes: e.target.value })}
            className="min-h-16 resize-none"
            maxLength={200}
          />
          <div className="text-xs text-muted-foreground text-right">
            {data.notes.length}/200
          </div>
        </div>
      </div>
    </div>
  );
};