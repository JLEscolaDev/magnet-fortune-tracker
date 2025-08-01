import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useManualAuth = () => {
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('[AUTH] Sign in error:', error);
        return { error };
      }
      
      console.log('[AUTH] Sign in successful');
      return { data, error: null };
    } catch (error) {
      console.error('[AUTH] Sign in exception:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      
      if (error) {
        console.error('[AUTH] Sign up error:', error);
        return { error };
      }
      
      console.log('[AUTH] Sign up successful');
      return { data, error: null };
    } catch (error) {
      console.error('[AUTH] Sign up exception:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[AUTH] Sign out error:', error);
        return { error };
      }
      
      console.log('[AUTH] Sign out successful');
      localStorage.clear(); // Clear any cached data
      return { error: null };
    } catch (error) {
      console.error('[AUTH] Sign out exception:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[AUTH] Refresh session error:', error);
        return { error };
      }
      
      console.log('[AUTH] Session refreshed successfully');
      return { data, error: null };
    } catch (error) {
      console.error('[AUTH] Refresh session exception:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    signIn,
    signUp,
    signOut,
    refreshSession,
    loading
  };
};