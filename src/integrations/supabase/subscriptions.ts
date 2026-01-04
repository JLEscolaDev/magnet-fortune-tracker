import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';
import { Subscription } from '@/types/fortune';

export type ActiveSubscription = Subscription;

/**
 * Get the active subscription for the current user
 * Returns null if no active subscription or user is not logged in
 */
export async function getActiveSubscription(
  supabase: SupabaseClient<Database>
): Promise<ActiveSubscription | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .or(
        `and(is_lifetime.eq.true,status.eq.active),
         and(status.eq.active,current_period_end.gte.${now})`
      )
      .maybeSingle();

    if (error) {
      console.error('Error fetching active subscription:', error);
      return null;
    }

    return data ?? null;
  } catch (error) {
    console.error('Error in getActiveSubscription:', error);
    return null;
  }
}

/**
 * Check if the current user has an active subscription
 * Returns false if no active subscription or user is not logged in
 */
export async function hasActiveSubscription(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const activeSubscription = await getActiveSubscription(supabase);
  return activeSubscription !== null;
}

/**
 * Get all subscriptions for the current user (including inactive ones)
 * Returns empty array if user is not logged in
 */
export async function getUserSubscriptions(
  supabase: SupabaseClient<Database>
): Promise<Subscription[]> {
  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return [];
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user subscriptions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserSubscriptions:', error);
    return [];
  }
}