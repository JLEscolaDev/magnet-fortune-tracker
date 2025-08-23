import { supabase } from '@/integrations/supabase/client';

export type FortuneRecord = {
  id: string;
  user_id: string;
  text: string;
  category: string;
  created_at: string;
  fortune_level?: number | null;
  fortune_value?: number | null;
};

export async function createFortune(
  text: string,
  category: string,
  value: number = 0,
  createdAtISO?: string
) {
  const { data, error } = await (supabase.rpc as any)('fortune_put', {
    p_text: text,
    p_category: category,
    p_fortune_level: Math.floor(value) || 0,
    p_created_at: createdAtISO ? new Date(createdAtISO) : null,
  });
  if (error) {
    console.error('[RPC] fortune_put error:', error);
    throw error;
  }
  return data;
}

export async function getFortunesForDateRange(
  startISO?: string | null,
  endISO?: string | null
): Promise<FortuneRecord[]> {
  const { data, error } = await (supabase.rpc as any)('fortune_list', {
    p_from: startISO ? new Date(startISO) : null,
    p_to: endISO ? new Date(endISO) : null,
  });
  if (error) {
    console.error('[RPC] fortune_list error:', error);
    throw error;
  }
  return (data || []) as FortuneRecord[];
}

export async function getTodayFortunesUTC(): Promise<FortuneRecord[]> {
  const now = new Date();
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return getFortunesForDateRange(start.toISOString(), end.toISOString());
}

// Get fortune counts
export async function getFortuneCounts() {
  const { data, error } = await (supabase.rpc as any)('fortune_counts');

  if (error) throw error;
  return {
    total: data?.total || 0,
    today: data?.today || 0
  };
}

// Legacy compatibility functions
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

export async function getFortunesByUser(userId: string): Promise<FortuneRecord[]> {
  const { data, error } = await (supabase.rpc as any)('fortune_list', {
    p_from: null,
    p_to: null,
  });

  if (error) throw error;
  return (data || []) as FortuneRecord[];
}