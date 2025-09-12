import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { KnowMyselfWizard } from './knowmyself/KnowMyselfWizard';

export const LifestyleTrackerTab = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <div className="space-y-6 p-6 pb-24 md:pb-6">
      {/* Date Selection */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-medium flex items-center gap-2">
            <Calendar className="text-gold" size={24} />
            Know Myself
          </h3>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="w-40"
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Track your daily well-being with our mobile-first survey. Quick and easy self-assessment.
        </p>
      </Card>

      <KnowMyselfWizard selectedDate={selectedDate} />
    </div>
  );
};