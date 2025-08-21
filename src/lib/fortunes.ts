import { supabase } from "@/integrations/supabase/client";
import type { Fortune } from "@/types/fortune";

// Create a new fortune (encryption happens automatically on DB trigger)
export async function createFortune(
  userId: string, 
  text: string, 
  category: string, 
  fortuneValue?: number | null,
  createdAt?: string
) {
  const insertData: any = {
    user_id: userId,
    text,
    category,
  };

  if (fortuneValue !== undefined) {
    insertData.fortune_value = fortuneValue;
  }

  if (createdAt) {
    insertData.created_at = createdAt;
  }

  const { data, error } = await supabase
    .from("fortunes")
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get a single fortune by ID (decrypted text)
export async function getFortune(id: string): Promise<Fortune | null> {
  const { data, error } = await (supabase.rpc as any)("fortune_decrypt", { _id: id });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return {
    id: data[0].id,
    user_id: data[0].user_id,
    text: data[0].text, // decrypted text
    category: data[0].category,
    fortune_level: data[0].fortune_level,
    fortune_value: data[0].fortune_value,
    created_at: data[0].created_at,
  };
}

// Get all fortunes for a user (decrypted)
export async function getFortunesByUser(userId: string): Promise<Fortune[]> {
  const { data, error } = await (supabase.rpc as any)("fortune_list");

  if (error) throw error;
  return data.map((f: any) => ({
    id: f.id,
    user_id: f.user_id,
    text: f.text, // decrypted text
    category: f.category,
    fortune_level: f.fortune_level,
    fortune_value: f.fortune_value,
    created_at: f.created_at,
  }));
}

// Update a fortune
export async function updateFortune(
  id: string, 
  updates: Partial<{ text: string; category: string; fortune_value: number | null }>
) {
  const { error } = await supabase
    .from('fortunes')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

// Delete a fortune
export async function deleteFortune(id: string) {
  const { error } = await supabase
    .from('fortunes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Get fortune count for a user
export async function getFortunesCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('fortunes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count || 0;
}

// Get fortunes for date range
export async function getFortunesForDateRange(
  userId: string, 
  startDate: string, 
  endDate: string
): Promise<Fortune[]> {
  const fortunes = await getFortunesByUser(userId);
  return fortunes.filter(fortune => {
    const fortuneDate = fortune.created_at;
    return fortuneDate >= startDate && fortuneDate < endDate;
  });
}