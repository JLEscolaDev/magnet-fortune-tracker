import { useState, useEffect, useCallback } from 'react';
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

  const fetchDailyQuote = useCallback(async () => {
    if (!profile?.user_id) return;

    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // First, get total count of quotes
      const { count, error: countError } = await supabase
        .from('quotes_master')
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
        .from('quotes_master')
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
  }, [profile?.user_id]);

  useEffect(() => {
    fetchDailyQuote();
  }, [fetchDailyQuote]);

  if (loading) {
    return (
      <div className="px-3 md:px-0 mb-2">
        <div className="text-center animate-pulse">
          <div className="h-3 bg-muted/30 rounded w-3/4 mx-auto mb-1.5" />
          <div className="h-2.5 bg-muted/30 rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <div className="px-3 md:px-0 mb-2">
      <div className="text-center">
        <span className="block mb-1 text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Daily Inspiration
        </span>
        <p className="text-sm md:text-base font-medium text-foreground italic leading-snug">
          “{quote.text_en}”
          {quote.author && (
            <span className="ml-2 text-xs md:text-sm text-muted-foreground not-italic">
              — {quote.author}
              {quote.source ? `, ${quote.source}` : ''}
            </span>
          )}
        </p>
      </div>
    </div>
  );
};