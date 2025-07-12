import { format } from 'date-fns';
import { Fortune } from '@/types/fortune';
import { 
  CurrencyDollar, 
  Heart, 
  HeartStraight, 
  Sparkle, 
  Question 
} from '@phosphor-icons/react';

interface FortuneListProps {
  fortunes: Fortune[];
  title?: string;
}

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
      return <Question size={16} className="text-muted-foreground" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Wealth':
      return 'bg-gold/20 text-gold border-gold/30';
    case 'Health':
      return 'bg-red-400/20 text-red-400 border-red-400/30';
    case 'Love':
      return 'bg-pink-400/20 text-pink-400 border-pink-400/30';
    case 'Opportunity':
      return 'bg-emerald/20 text-emerald border-emerald/30';
    default:
      return 'bg-muted/20 text-muted-foreground border-muted/30';
  }
};

export const FortuneList = ({ fortunes, title = "Today's Fortunes" }: FortuneListProps) => {
  if (fortunes.length === 0) {
    return (
      <div className="luxury-card p-6">
        <h3 className="text-lg font-heading font-medium mb-4">{title}</h3>
        <div className="text-center py-8">
          <Sparkle size={48} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No fortunes tracked yet</p>
          <p className="text-sm text-muted-foreground">Tap the + button to add your first fortune</p>
        </div>
      </div>
    );
  }

  return (
    <div className="luxury-card p-6">
      <h3 className="text-lg font-heading font-medium mb-4">{title}</h3>
      <div className="space-y-3">
        {fortunes.map((fortune) => (
          <div
            key={fortune.id}
            className="p-4 rounded-lg bg-muted/30 border border-muted/20 hover:border-gold/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm leading-relaxed flex-1">{fortune.text}</p>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(fortune.created_at), 'HH:mm')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${getCategoryColor(fortune.category)}`}
              >
                {getCategoryIcon(fortune.category)}
                {fortune.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};