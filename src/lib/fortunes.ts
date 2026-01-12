import { supabase } from '@/integrations/supabase/client';
import { Fortune, Achievement } from '@/types/fortune';

// Helper to detect legacy-looking data (optional UI badge)
export const looksLegacy = (text?: string | null): boolean => 
  !!text && text.length > 60 && /^[A-Za-z0-9+/=\n\r]+$/.test(text);

// Add a new fortune using RPC
export async function addFortune(
  text: string,
  category?: string | null,
  level?: number | null,
  selectedDate?: Date | null,
  impactLevel?: string | null
): Promise<{ fortuneId: string; streakInfo?: { firstOfDay: boolean; currentStreak: number; longestStreak: number } }> {
  console.log('[FORTUNES:addFortune] Adding fortune with RPC', { selectedDate });
  
  const { data, error } = await supabase.rpc('fortune_add', {
    p_text: text,
    p_category: category ?? null,
    p_level: level ?? null,
    p_created_at: selectedDate?.toISOString() ?? null,
    p_impact_level: (impactLevel as 'big_win' | 'milestone' | 'small_step' | null) ?? null,
  });

  if (error) {
    console.error('[RPC] fortune_add error:', error);
    throw error;
  }

  const fortuneId = data as string;

  // Track daily action for streak
  try {
    const { data: streakData, error: streakError } = await supabase.rpc('track_daily_action', {
      source_type: 'fortune',
      event_ts: selectedDate?.toISOString() ?? new Date().toISOString(),
    });

    if (streakError) {
      console.error('[RPC] track_daily_action error:', streakError);
    }

    return { 
      fortuneId, 
      streakInfo: streakData as { firstOfDay: boolean; currentStreak: number; longestStreak: number } 
    };
  } catch (streakError) {
    console.error('Error tracking daily action:', streakError);
    return { fortuneId };
  }
}

// Get initial list of fortunes
export async function getFortunesList(): Promise<Fortune[]> {
  const { data, error } = await (supabase.rpc as any)('fortune_list');

  if (error) {
    console.error('[RPC] fortune_list error:', error);
    throw error;
  }

  return (data || []) as Fortune[];
}

// Get fortunes with time window pagination (for loading older items)
export async function getFortunesListPaginated(
  pFrom?: string | null,
  pTo?: string | null
): Promise<Fortune[]> {
  const { data, error } = await (supabase.rpc as any)('fortune_list', {
    p_from: pFrom,
    p_to: pTo,
  });

  if (error) {
    console.error('[RPC] fortune_list paginated error:', error);
    throw error;
  }

  return (data || []) as Fortune[];
}

// Get fortunes for today (utility function)
export async function getTodayFortunes(): Promise<Fortune[]> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return getFortunesListPaginated(
    startOfDay.toISOString(),
    endOfDay.toISOString()
  );
}

// Get fortune counts using existing RPC
export async function getFortuneCounts() {
  const { data, error } = await (supabase.rpc as any)('fortune_counts');

  if (error) throw error;
  return {
    total: (data as any)?.total || 0,
    today: (data as any)?.today || 0
  };
}


// Legacy compatibility functions (keeping for backward compatibility)
export async function createFortune(
  text: string,
  category: string,
  value: number = 0,
  createdAtISO?: string
) {
  // Map to new RPC approach
  return addFortune(text, category, value);
}

export async function getFortunesForDateRange(
  startISO?: string | null,
  endISO?: string | null
): Promise<Fortune[]> {
  return getFortunesListPaginated(startISO, endISO);
}

export async function getTodayFortunesUTC(): Promise<Fortune[]> {
  return getTodayFortunes();
}

export async function getFortunesByUser(userId: string): Promise<Fortune[]> {
  return getFortunesList();
}

// Update fortune using RPC to handle encryption properly
export async function updateFortune(id: string, updates: { text?: string; category?: string; fortune_value?: number; impact_level?: string }) {
  console.log('[FORTUNES:updateFortune] Updating fortune with RPC', { id, updates });
  
  const { data, error } = await supabase.rpc('fortune_update', {
    p_id: id,
    p_text: updates.text || null,
    p_category: updates.category || null,
    p_fortune_value: updates.fortune_value || null,
    p_impact_level: updates.impact_level || null
  });

  if (error) {
    console.error('[RPC] fortune_update error:', error);
    throw error;
  }

  return data;
}

export async function deleteFortune(id: string) {
  const { error } = await supabase
    .from('fortunes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Tutorial completion achievement
export function createTutorialMasterAchievement(): Achievement {
  return {
    id: 'tutorial-master',
    title: 'Tutorial Master',
    description: 'Explored all features of Fortune Magnet',
    icon: '🎓',
    state: 'locked',
    requiredCount: 8, // Total number of tutorial steps
    progress: 0
  };
}

// Type alias for backward compatibility
export type FortuneRecord = Fortune;
