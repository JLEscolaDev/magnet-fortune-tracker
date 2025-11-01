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
      <div className="space-y-5">
        <div className="space-y-3">
          <Label style={{ color: '#BEBEBE' }} className="text-sm font-medium">
            What did you eat?
          </Label>
          <div className="relative">
            <Textarea
              placeholder="Breakfast, lunch, dinner, snacks..."
              value={data.meals}
              onChange={(e) => updateData({ meals: e.target.value })}
              className="min-h-20 resize-none wellness-card border-[#2D2D2D]"
              style={{ 
                background: 'rgba(20, 20, 20, 0.8)',
                color: '#F3F3F1'
              }}
              maxLength={200}
            />
            <div 
              className="absolute bottom-3 right-3 text-xs pointer-events-none"
              style={{ color: '#8F8F8F' }}
            >
              {data.meals.length}/200
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label style={{ color: '#BEBEBE' }} className="text-sm font-medium">
            Any dreams or sleep notes?
          </Label>
          <div className="relative">
            <Textarea
              placeholder="Describe your dreams or sleep quality..."
              value={data.dream_description}
              onChange={(e) => updateData({ dream_description: e.target.value })}
              className="min-h-20 resize-none wellness-card border-[#2D2D2D]"
              style={{ 
                background: 'rgba(20, 20, 20, 0.8)',
                color: '#F3F3F1'
              }}
              maxLength={200}
            />
            <div 
              className="absolute bottom-3 right-3 text-xs pointer-events-none"
              style={{ color: '#8F8F8F' }}
            >
              {data.dream_description.length}/200
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label style={{ color: '#BEBEBE' }} className="text-sm font-medium">
            Other thoughts or observations?
          </Label>
          <div className="relative">
            <Textarea
              placeholder="Anything else notable about your day..."
              value={data.notes}
              onChange={(e) => updateData({ notes: e.target.value })}
              className="min-h-20 resize-none wellness-card border-[#2D2D2D]"
              style={{ 
                background: 'rgba(20, 20, 20, 0.8)',
                color: '#F3F3F1'
              }}
              maxLength={200}
            />
            <div 
              className="absolute bottom-3 right-3 text-xs pointer-events-none"
              style={{ color: '#8F8F8F' }}
            >
              {data.notes.length}/200
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};