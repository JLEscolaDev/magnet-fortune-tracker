import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';

// Manual type definitions until types.ts is regenerated
export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ActiveSubscription = Subscription;

/**
 * Get the active subscription for the current user
 * Returns null if no active subscription or user is not logged in
 */
export async function getActiveSubscription(
  supabase: SupabaseClient<Database>
): Promise<ActiveSubscription | null> {
  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return null;
    }

    // Query the subscriptions table directly with active status filter
    // Use any to bypass type checking until types.ts is regenerated
    const { data, error } = await (supabase as any)
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('current_period_end', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('Error fetching active subscription:', error);
      return null;
    }

    return data as ActiveSubscription | null;
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

    // Use any to bypass type checking until types.ts is regenerated
    const { data, error } = await (supabase as any)
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