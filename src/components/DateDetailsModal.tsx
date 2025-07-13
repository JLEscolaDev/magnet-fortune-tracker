import { X, CurrencyDollar, Heart, HeartStraight, Sparkle } from '@phosphor-icons/react';
import { Fortune } from '@/types/fortune';
import { format } from 'date-fns';

interface DateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  fortunes: Fortune[];
}

export const DateDetailsModal = ({ isOpen, onClose, date, fortunes }: DateDetailsModalProps) => {
  if (!isOpen || !date) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Wealth':
        return <CurrencyDollar size={16} className="text-gold" />;
      case 'Health':
        return <HeartStraight size={16} className="text-red-400" />;
      case 'Love':
        return <Heart size={16} className="text-pink-400" />;
      case 'Opportunity':
        return <Sparkle size={16} className="text-emerald" />;
      default:
        return <Sparkle size={16} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md luxury-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-semibold">
            {format(date, 'MMMM d, yyyy')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {fortunes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No fortunes recorded for this day
            </p>
          ) : (
            fortunes.map((fortune) => (
              <div key={fortune.id} className="luxury-card p-4 bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  {getCategoryIcon(fortune.category)}
                  <span className="text-sm font-medium text-gold">
                    {fortune.category}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(fortune.created_at), 'h:mm a')}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{fortune.text}</p>
                {fortune.fortune_level && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Level: {fortune.fortune_level}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};