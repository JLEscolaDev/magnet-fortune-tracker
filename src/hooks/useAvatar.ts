import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Avatar {
  id: string;
  level: number;
  url: string;
  title: string | null;
}

// Shared cache for avatars (static data, can be cached indefinitely)
const avatarCache = new Map<number, Avatar>();
const pendingFetches = new Map<number, Promise<Avatar | null>>();

/**
 * Hook to fetch avatar by level with shared cache to prevent duplicate queries
 */
export const useAvatar = (level: number): { avatar: Avatar | null; loading: boolean } => {
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!level || level < 1) {
      setAvatar(null);
      setLoading(false);
      return;
    }

    // Check cache first
    if (avatarCache.has(level)) {
      const cachedAvatar = avatarCache.get(level)!;
      if (!cancelled) {
        setAvatar(cachedAvatar);
        setLoading(false);
      }
      return;
    }

    // Check if there's already a pending fetch for this level
    const pendingFetch = pendingFetches.get(level);
    if (pendingFetch) {
      pendingFetch.then((data) => {
        if (!cancelled) {
          setAvatar(data);
          setLoading(false);
        }
      }).catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
      return;
    }

    // Create new fetch
    setLoading(true);
    const fetchPromise = (async () => {
      try {
        const { data: avatarData, error } = await supabase
          .from('avatars')
          .select('*')
          .eq('level', level)
          .maybeSingle();

        if (error) {
          console.error('Error fetching avatar:', error);
          return null;
        }

        if (avatarData) {
          // Store in cache
          avatarCache.set(level, avatarData);
          return avatarData;
        }

        return null;
      } catch (error) {
        console.error('Error fetching avatar:', error);
        return null;
      } finally {
        // Remove from pending fetches
        pendingFetches.delete(level);
      }
    })();

    // Store pending fetch
    pendingFetches.set(level, fetchPromise);

    fetchPromise.then((data) => {
      if (!cancelled) {
        setAvatar(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [level]);

  return { avatar, loading };
};

