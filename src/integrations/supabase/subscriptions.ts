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
    if (authError || !user) {
      return null;
    }

    // With UNIQUE constraint on user_id, there is exactly one row per user or none
    // Query the single subscription row for this user
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }

    // No subscription found
    if (!data) {
      return null;
    }

    // Lifetime subscriptions are always active if status is active
    if (data.is_lifetime === true && data.status === 'active') {
      return data;
    }

    // For recurring subscriptions, check Stripe status
    // Only 'active' and 'trialing' grant access
    // 'past_due' and 'canceled' do NOT grant access
    if (data.status === 'active' || data.status === 'trialing') {
      // Also verify period hasn't ended (double-check)
      if (data.current_period_end) {
        const periodEnd = new Date(data.current_period_end);
        if (periodEnd > new Date()) {
          return data;
        }
      } else {
        // If no period_end, trust Stripe status
        return data;
      }
    }

    // Subscription exists but is not active (past_due, canceled, etc.)
    return null;
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