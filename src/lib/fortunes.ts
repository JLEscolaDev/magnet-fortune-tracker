import { supabase } from '@/integrations/supabase/client';

// Create a new fortune (encryption happens automatically on DB trigger)
export async function createFortune(text: string, createdAt?: string, category?: string, fortuneValue?: number) {
  const { data, error } = await (supabase.rpc as any)('fortune_put', {
    p_text: text,
    p_category: category ?? null,
    p_fortune_level: 0,
    p_created_at: createdAt ?? null
  });

  if (error) throw error;
  return data;
}

// Get fortunes for date range (decrypted)
export async function getFortunesForDateRange(startISO?: string, endISO?: string) {
  const { data, error } = await (supabase.rpc as any)('fortune_list', {
    p_from: startISO ?? null,
    p_to: endISO ?? null
  });

  if (error) throw error;
  return (data || []).map((f: any) => ({
    id: f.id,
    created_at: f.created_at,
    text: f.text // text is already plaintext
  }));
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

export async function getFortunesByUser(userId: string) {
  const { data, error } = await (supabase.rpc as any)('fortune_list');

  if (error) throw error;
  return (data || []).map((f: any) => ({
    id: f.id,
    user_id: f.user_id,
    text: f.text,
    category: f.category,
    fortune_level: f.fortune_level,
    fortune_value: f.fortune_value,
    created_at: f.created_at,
  }));
}