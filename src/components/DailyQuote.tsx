import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppState } from '@/contexts/AppStateContext';

interface Quote {
  id: string;
  text_en: string;
  text_es?: string;
  author?: string;
  source?: string;
}

export const DailyQuote = () => {
  const { profile } = useAppState();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  const getDailyQuoteIndex = (userId: string, date: string): number => {
    // Create a deterministic "random" number based on user ID + date
    const combined = userId + date;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };

  const fetchDailyQuote = async () => {
    if (!profile?.user_id) return;

    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // First, get total count of quotes
      const { count, error: countError } = await supabase
        .from('quotes_master' as any)
        .select('*', { count: 'exact', head: true });

      if (countError || !count || count === 0) {
        console.error('Error fetching quote count:', countError);
        setLoading(false);
        return;
      }

      // Calculate which quote to show based on user ID and date
      const quoteIndex = getDailyQuoteIndex(profile.user_id, today) % count;

      // Fetch the specific quote at that index
      const { data: quotes, error } = await supabase
        .from('quotes_master' as any)
        .select('id, text_en, text_es, author, source')
        .range(quoteIndex, quoteIndex)
        .limit(1);

      if (error) {
        console.error('Error fetching daily quote:', error);
        return;
      }

      if (quotes && quotes.length > 0) {
        setQuote(quotes[0] as unknown as Quote);
      }
    } catch (error) {
      console.error('Error in fetchDailyQuote:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyQuote();
  }, [profile?.user_id]);

  if (loading) {
    return (
      <div className="luxury-card p-6 mb-6 animate-pulse">
        <div className="text-center">
          <div className="h-4 bg-muted/30 rounded w-3/4 mx-auto mb-2" />
          <div className="h-3 bg-muted/30 rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <div className="luxury-card p-6 mb-6">
      <div className="text-center">
        <div className="mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Daily Inspiration
          </span>
        </div>
        <blockquote className="text-base font-medium text-foreground mb-3 italic">
          "{quote.text_en}"
        </blockquote>
        {quote.author && (
          <cite className="text-sm text-muted-foreground">
            — {quote.author}
            {quote.source && `, ${quote.source}`}
          </cite>
        )}
      </div>
    </div>
  );
};