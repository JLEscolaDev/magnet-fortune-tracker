import { supabase } from '@/integrations/supabase/client';
import { Fortune } from '@/types/fortune';

// Helper to detect legacy-looking data (optional UI badge)
export const looksLegacy = (text?: string | null): boolean => 
  !!text && text.length > 60 && /^[A-Za-z0-9+/=\n\r]+$/.test(text);

// Add a new fortune using RPC
export async function addFortune(
  text: string,
  category?: string | null,
  level?: number | null
): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('fortune_add', {
    p_text: text,
    p_category: category ?? null,
    p_level: level ?? null,
  });

  if (error) {
    console.error('[RPC] fortune_add error:', error);
    throw error;
  }

  return data as string; // Returns the new fortune ID
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

// These functions now use direct table access for updates/deletes
// since they're not covered by the new RPC approach
export async function updateFortune(id: string, updates: any) {
  const { error } = await supabase
    .from('fortunes')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteFortune(id: string) {
  const { error } = await supabase
    .from('fortunes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Type alias for backward compatibility
export type FortuneRecord = Fortune;
