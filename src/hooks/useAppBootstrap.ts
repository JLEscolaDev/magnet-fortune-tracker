import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getFortuneCounts } from '@/lib/fortunes';
import { Profile, Subscription } from '@/types/fortune';
// @ts-expect-error temporary workaround for module resolution
import type { Database } from '@/types/database.types';

interface AppBootstrapState {
  profile: Profile | null;
  fortunesCountToday: number;
  fortunesCountTotal: number;
  activeSubscription: Subscription | null;
  loading: boolean;
  errors: { source: string; message: string; timestamp: number }[];
  retryCount: number;
  bootstrapFailed: boolean;
}

const logWithPrefix = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BOOTSTRAP] ${step}${detailsStr}`);
};

export const useAppBootstrap = (user: User | null) => {
  const [state, setState] = useState<AppBootstrapState>({
    profile: null,
    fortunesCountToday: 0,
    fortunesCountTotal: 0,
    activeSubscription: null,
    loading: true,
    errors: [],
    retryCount: 0,
    bootstrapFailed: false,
  });
  const bootstrapInitialized = useRef(false);

  const addError = useCallback((source: string, message: string) => {
    logWithPrefix(`ERROR from ${source}`, { message });
    setState(prev => ({
      ...prev,
      errors: [...prev.errors, { source, message, timestamp: Date.now() }].slice(-10) // Keep last 10 errors
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: [] }));
  }, []);

  const ensureProfile = async (user: User, retryCount: number = 0): Promise<Profile | null> => {
    try {
      if (!user?.id) {
        logWithPrefix('ERROR: No user ID provided');
        addError('profiles-ensure', 'No user ID provided');
        return null;
      }

      logWithPrefix('Ensuring profile exists', { userId: user.id, retry: retryCount });
      
      // Try to get existing profile by user_id (not id)
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id as unknown as Database['public']['Tables']['profiles']['Row']['user_id'])
        .maybeSingle<Database['public']['Tables']['profiles']['Row']>();

      if (fetchError) {
        console.warn(`[QUERY:profiles] Error fetching profile: ${fetchError.message}`);
        
        // Retry once if it might be a timing issue
        if (retryCount === 0 && (fetchError.message.includes('JWT') || fetchError.message.includes('RLS'))) {
          logWithPrefix('Profile fetch failed, retrying once...', { error: fetchError.message });
          await new Promise(resolve => setTimeout(resolve, 200));
          return ensureProfile(user, 1);
        }
        
        addError('profiles-fetch', fetchError.message);
        return null;
      }

      if (existingProfile && !('error' in existingProfile)) {
        logWithPrefix('Profile found successfully', { 
          userId: existingProfile.user_id,
          displayName: existingProfile.display_name,
          level: existingProfile.level,
          totalFortunes: existingProfile.total_fortunes
        });
        if (!existingProfile.display_name) console.warn('Profile missing display_name');
        if (existingProfile.level === null) console.warn('Profile missing level');
        if (existingProfile.total_fortunes === null) console.warn('Profile missing total_fortunes');
        return existingProfile;
      }

      // Create new profile if none exists
      logWithPrefix('Creating new profile');
      const displayName = user.email?.split('@')[0] || 'Fortune Seeker';

      const insertPayload: Database['public']['Tables']['profiles']['Insert'] = {
        user_id: user.id as unknown as Database['public']['Tables']['profiles']['Insert']['user_id'],
        display_name: displayName,
        avatar_url: null,
        level: 1,
        total_fortunes: 0
      };
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([insertPayload])
        .select()
        .single<Database['public']['Tables']['profiles']['Row']>();

      if (insertError) {
        console.warn(`[QUERY:profiles] Error creating profile: ${insertError.message}`);
        addError('profiles-create', insertError.message);
        return null;
      }

      if (newProfile && !('error' in newProfile)) {
        logWithPrefix('Profile created', { displayName: newProfile.display_name });
        return newProfile;
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addError('profiles-ensure', message);
      return null;
    }
  };

  const fetchCounts = async (userId: string) => {
    try {
      if (!userId) {
        logWithPrefix('ERROR: No userId provided for fetching counts');
        addError('fortunes-counts', 'No userId provided');
        return { total: 0, today: 0 };
      }
      
      logWithPrefix('Fetching fortune counts', { userId });

      // Get fortune counts using RPC
      const fortuneCounts = await getFortuneCounts();
      const totalCount = fortuneCounts.total;
      const todayCount = fortuneCounts.today;
      logWithPrefix('Today fortunes count fetched', { todayCount });

      logWithPrefix('Fortune counts completed', { total: totalCount, today: todayCount });
      return { total: totalCount || 0, today: todayCount || 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addError('fortunes-counts', message);
      return { total: 0, today: 0 };
    }
  };

  const fetchActiveSubscription = async (userId: string): Promise<Subscription | null> => {
    try {
      if (!userId) {
        logWithPrefix('ERROR: No userId provided for fetching subscription');
        addError('subscriptions-fetch', 'No userId provided');
        return null;
      }
      
      logWithPrefix('Fetching active subscription', { userId });

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId as unknown as Database['public']['Tables']['subscriptions']['Row']['user_id'])
        .eq('status', 'active' as Database['public']['Tables']['subscriptions']['Row']['status'])
        .gte('current_period_end', new Date().toISOString())
        .maybeSingle();

      if (error) {
        console.warn(`[QUERY:subscriptions] Error fetching subscription: ${error.message}`);
        addError('subscriptions-fetch', error.message);
        return null;
      }

      if (data && !('error' in data)) {
        logWithPrefix('Subscription fetch completed', { hasActive: !!data });
        return data;
      }
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addError('subscriptions-fetch', message);
      return null;
    }
  };

  const bootstrap = useCallback(async (retryAttempt: number = 0) => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 10000; // 10 seconds timeout per attempt

    if (!user || !user.id) {
      logWithPrefix('Invalid user or user missing ID, resetting state');
      setState({
        profile: null,
        fortunesCountToday: 0,
        fortunesCountTotal: 0,
        activeSubscription: null,
        loading: false,
        errors: [],
        retryCount: 0,
        bootstrapFailed: false,
      });
      return;
    }

    try {
      logWithPrefix(`Starting bootstrap attempt ${retryAttempt + 1}/${MAX_RETRIES}`, { userId: user.id, email: user.email });
      setState(prev => ({ ...prev, loading: true, retryCount: retryAttempt }));

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Bootstrap timeout')), TIMEOUT_MS);
      });

      // Add a small delay for session restore to ensure Supabase client context is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Run all fetches in parallel with timeout
      logWithPrefix('Starting parallel data fetch with timeout');
      
      const fetchPromise = Promise.all([
        ensureProfile(user),
        fetchCounts(user.id),
        fetchActiveSubscription(user.id)
      ]);

      const [profile, counts, subscription] = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as [Profile | null, { total: number; today: number }, Subscription | null];

      if (profile && 'error' in profile) {
        throw new Error('Profile fetch returned error');
      }

      logWithPrefix('Parallel data fetch completed', {
        profileLoaded: !!profile,
        countsLoaded: !!counts,
        subscriptionLoaded: !!subscription
      });

      if (!profile) {
        throw new Error('Profile not found - authentication context may not be ready');
      }

      setState(prev => ({
        ...prev,
        profile,
        fortunesCountToday: counts.today,
        fortunesCountTotal: counts.total,
        activeSubscription: subscription,
        loading: false,
        retryCount: retryAttempt,
        bootstrapFailed: false,
      }));

      logWithPrefix('Bootstrap completed successfully', { 
        hasProfile: !!profile, 
        profileDisplayName: profile && !('error' in profile) ? profile.display_name : undefined,
        totalFortunes: counts.total,
        todayFortunes: counts.today,
        hasSubscription: !!subscription 
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppBootstrap.ts:bootstrap:success',message:'Bootstrap completed successfully',data:{hasProfile:!!profile,profileDisplayName:profile?.display_name,totalFortunes:counts.total,todayFortunes:counts.today,hasSubscription:!!subscription},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppBootstrap.ts:bootstrap:error',message:'Bootstrap error',data:{error:message,retryAttempt,willRetry:retryAttempt<MAX_RETRIES-1},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      logWithPrefix(`Bootstrap failed on attempt ${retryAttempt + 1}`, { error: message });
      addError('bootstrap', message);

      if (retryAttempt < MAX_RETRIES - 1) {
        // Retry with exponential backoff
        const retryDelay = Math.pow(2, retryAttempt) * 1000; // 1s, 2s, 4s
        logWithPrefix(`Retrying bootstrap in ${retryDelay}ms...`);
        setTimeout(() => bootstrap(retryAttempt + 1), retryDelay);
      } else {
        // All retries exhausted - mark as failed
        logWithPrefix('All bootstrap retries exhausted - marking as failed');
        setState(prev => ({ 
          ...prev, 
          loading: false,
          retryCount: retryAttempt,
          bootstrapFailed: true,
        }));
      }
    }
  }, [addError, user]);

  // Run bootstrap when user changes - direct dependency on user
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppBootstrap.ts:useEffect',message:'Bootstrap effect triggered',data:{hasUser:!!user,userId:user?.id,alreadyInitialized:bootstrapInitialized.current},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const isValidUser = Boolean(user?.id);
    if (!isValidUser) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppBootstrap.ts:useEffect:noUser',message:'User not valid, skipping bootstrap',data:{hasUser:!!user,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      logWithPrefix('User not yet available or invalid, delaying bootstrap until user is set');
      bootstrapInitialized.current = false;
      return;
    }

    // Guard against multiple bootstrap calls for the same user
    if (bootstrapInitialized.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppBootstrap.ts:useEffect:alreadyInit',message:'Bootstrap already initialized, skipping',data:{userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      logWithPrefix('Bootstrap already initialized for this user, skipping');
      return;
    }
    bootstrapInitialized.current = true;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9668e307-86e2-4d4d-997d-e4e0575f8e45',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppBootstrap.ts:useEffect:triggering',message:'Triggering bootstrap',data:{userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    logWithPrefix('User available, triggering bootstrap', { hasUser: !!user, userId: user?.id });
    bootstrap();
  }, [user, bootstrap]);

  return {
    ...state,
    addError,
    clearErrors,
    refetch: bootstrap,
  };
};