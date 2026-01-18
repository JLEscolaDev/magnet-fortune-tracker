import { supabase } from '@/integrations/supabase/client';
import { Fortune } from '@/types/fortune';

// Centralized fortune_list fetcher with guards to prevent infinite loops
// This ensures fortune_list is only called:
// - On app start once (initial bootstrap)
// - On explicit user gesture (pull-to-refresh / button)
// - On foreground resume once, with debounce of at least 30 seconds

interface FetchOptions {
  p_from?: string | null;
  p_to?: string | null;
  force?: boolean; // Bypass debounce for explicit user actions
}

// Global state for guards
const fetchState = {
  inFlight: false,
  lastFetchAt: 0,
  DEBOUNCE_MS: 30000, // 30 seconds minimum debounce
};

/**
 * Centralized function to fetch fortune_list with guards
 * @param options - Fetch options including date range and force flag
 * @returns Promise<Fortune[]> or null if skipped
 */
export async function fetchFortuneList(options: FetchOptions = {}): Promise<Fortune[] | null> {
  const { p_from, p_to, force = false } = options;
  
  // Guard 1: Check if already in flight
  if (fetchState.inFlight) {
    console.log('[FORTUNE_LIST] skip: inflight');
    return null;
  }
  
  // Guard 2: Debounce check (unless forced by user action)
  const now = Date.now();
  const timeSinceLastFetch = now - fetchState.lastFetchAt;
  if (!force && timeSinceLastFetch < fetchState.DEBOUNCE_MS) {
    console.log(`[FORTUNE_LIST] skip: debounce (${Math.round(timeSinceLastFetch / 1000)}s ago, need ${fetchState.DEBOUNCE_MS / 1000}s)`);
    return null;
  }
  
  // Guard 3: Check if user is authenticated
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[FORTUNE_LIST] skip: no user');
      return null;
    }
  } catch (error) {
    console.log('[FORTUNE_LIST] skip: auth check failed', error);
    return null;
  }
  
  // All guards passed - proceed with fetch
  console.log('[FORTUNE_LIST] fetch start', { p_from, p_to, force });
  fetchState.inFlight = true;
  fetchState.lastFetchAt = now;
  
  try {
    const params: any = {};
    if (p_from !== undefined) params.p_from = p_from;
    if (p_to !== undefined) params.p_to = p_to;
    
    const { data, error } = await (supabase.rpc as any)('fortune_list', Object.keys(params).length > 0 ? params : undefined);
    
    if (error) {
      console.error('[FORTUNE_LIST] error:', error);
      throw error;
    }
    
    console.log('[FORTUNE_LIST] done', { count: data?.length || 0 });
    return (data || []) as Fortune[];
  } catch (error) {
    console.error('[FORTUNE_LIST] fetch failed:', error);
    throw error;
  } finally {
    fetchState.inFlight = false;
  }
}

/**
 * Reset fetch state (useful for testing or explicit refresh)
 */
export function resetFortuneListFetchState() {
  fetchState.inFlight = false;
  fetchState.lastFetchAt = 0;
}

/**
 * Get current fetch state (for debugging)
 */
export function getFortuneListFetchState() {
  return {
    inFlight: fetchState.inFlight,
    lastFetchAt: fetchState.lastFetchAt,
    timeSinceLastFetch: Date.now() - fetchState.lastFetchAt,
  };
}
