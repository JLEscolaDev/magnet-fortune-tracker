import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, Subscription } from '@/types/fortune';

interface AppBootstrapState {
  profile: Profile | null;
  fortunesCountToday: number;
  fortunesCountTotal: number;
  activeSubscription: Subscription | null;
  loading: boolean;
  errors: Array<{ source: string; message: string; timestamp: number }>;
}

const logWithPrefix = (step: string, details?: any) => {
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
  });

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
        .eq('user_id', user.id)
        .maybeSingle();

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

      if (existingProfile) {
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
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([{
          user_id: user.id,
          display_name: displayName,
          avatar_url: null,
          level: 1,
          total_fortunes: 0
        }])
        .select()
        .single();

      if (insertError) {
        console.warn(`[QUERY:profiles] Error creating profile: ${insertError.message}`);
        addError('profiles-create', insertError.message);
        return null;
      }

      logWithPrefix('Profile created', { displayName: newProfile.display_name });
      return newProfile;
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

      // Get total fortunes count
      const { count: totalCount, error: totalError } = await supabase
        .from('fortunes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (totalError) {
        console.warn(`[QUERY:fortunes] Error fetching total count: ${totalError.message}`);
        addError('fortunes-count-total', totalError.message);
      } else {
        logWithPrefix('Total fortunes count fetched', { totalCount });
      }

      // Get today's fortunes count (UTC midnight boundary)
      const today = new Date();
      const startOfDayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const endOfDayUTC = new Date(startOfDayUTC.getTime() + 24 * 60 * 60 * 1000);

      const { count: todayCount, error: todayError } = await supabase
        .from('fortunes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfDayUTC.toISOString())
        .lt('created_at', endOfDayUTC.toISOString());

      if (todayError) {
        console.warn(`[QUERY:fortunes] Error fetching today count: ${todayError.message}`);
        addError('fortunes-count-today', todayError.message);
      } else {
        logWithPrefix('Today fortunes count fetched', { todayCount });
      }

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
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('current_period_end', new Date().toISOString())
        .maybeSingle();

      if (error) {
        console.warn(`[QUERY:subscriptions] Error fetching subscription: ${error.message}`);
        addError('subscriptions-fetch', error.message);
        return null;
      }

      logWithPrefix('Subscription fetch completed', { hasActive: !!data });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addError('subscriptions-fetch', message);
      return null;
    }
  };

  const bootstrap = useCallback(async () => {
    if (!user) {
      logWithPrefix('No user, clearing state');
      setState({
        profile: null,
        fortunesCountToday: 0,
        fortunesCountTotal: 0,
        activeSubscription: null,
        loading: false,
        errors: [],
      });
      return;
    }

    try {
      logWithPrefix('Starting bootstrap', { userId: user.id, email: user.email });
      setState(prev => ({ ...prev, loading: true }));

      // Add a small delay for session restore to ensure Supabase client context is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Run all fetches in parallel for better performance
      logWithPrefix('Starting parallel data fetch');
      
      const [profile, counts, subscription] = await Promise.all([
        ensureProfile(user),
        fetchCounts(user.id),
        fetchActiveSubscription(user.id)
      ]);

      logWithPrefix('Parallel data fetch completed', {
        profileLoaded: !!profile,
        countsLoaded: !!counts,
        subscriptionLoaded: !!subscription
      });

      if (!profile) {
        logWithPrefix('ERROR: Profile fetch failed completely');
        addError('bootstrap', 'Profile not found - authentication context may not be ready');
      }

      setState(prev => ({
        ...prev,
        profile,
        fortunesCountToday: counts.today,
        fortunesCountTotal: counts.total,
        activeSubscription: subscription,
        loading: false,
      }));

      logWithPrefix('Bootstrap completed', { 
        hasProfile: !!profile, 
        profileDisplayName: profile?.display_name,
        totalFortunes: counts.total,
        todayFortunes: counts.today,
        hasSubscription: !!subscription 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logWithPrefix('Bootstrap failed', { error: message });
      addError('bootstrap', message);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user, addError]);

  // Run bootstrap when user changes
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return {
    ...state,
    addError,
    clearErrors,
    refetch: bootstrap,
  };
};