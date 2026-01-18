import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getFortuneMedia } from '@/integrations/supabase/fortuneMedia';
import { useSignedUrl, clearSignedUrlCacheFor } from '@/hooks/useSignedUrl';

interface FortunePhotoProps {
  fortuneId: string;
  className?: string;
  photoUpdatedAt?: string; // Optional: updated_at from fortunePhotoUpdated event
}

export const FortunePhoto: React.FC<FortunePhotoProps> = ({ fortuneId, className = "", photoUpdatedAt }) => {
  const [media, setMedia] = useState<{ bucket: string; path: string; version: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cacheBuster, setCacheBuster] = useState<string>(Date.now().toString());
  
  // Track the last loaded version to prevent unnecessary reloads
  const lastLoadedVersion = useRef<string | null>(null);
  // Track if a reload is pending to debounce multiple events
  const pendingReload = useRef<NodeJS.Timeout | null>(null);
  // Track signed URL from finalize response (valid for 5 minutes)
  const immediateSignedUrlRef = useRef<{ url: string; expiresAt: number } | null>(null);

  // Retry signed URL creation a few times to handle eventual consistency (without spamming)
  const signedUrlRetryTimer = useRef<NodeJS.Timeout | null>(null);
  const signedUrlRetryCount = useRef<number>(0);
  const signedUrlRetryKey = useRef<string | null>(null);

  // Use immediate signed URL if available and not expired, otherwise use hook
  const hookSignedUrl = useSignedUrl(media?.bucket, media?.path, 300, media?.version);
  const signedUrl = (() => {
    const immediate = immediateSignedUrlRef.current;
    if (immediate && immediate.expiresAt > Date.now()) {
      return immediate.url;
    }
    return hookSignedUrl;
  })();

  const loadMedia = useCallback(async (forceRefresh = false) => {
    try {
      setError(false);
      setLoading(true);

      const mediaData = await getFortuneMedia(fortuneId);

      if (mediaData?.path && mediaData?.bucket) {
        const version = mediaData.updated_at || mediaData.created_at || '';

        // Only update state if version changed or force refresh
        if (forceRefresh || version !== lastLoadedVersion.current) {
          console.log('[FORTUNE-PHOTO] loadMedia - updating state:', {
            fortuneId,
            path: mediaData.path,
            version,
            previousVersion: lastLoadedVersion.current,
          });
          lastLoadedVersion.current = version;
          const rawPath = mediaData.path;
          const normalizedPath = (() => {
            const p = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
            const prefix = `${mediaData.bucket}/`;
            return p.startsWith(prefix) ? p.slice(prefix.length) : p;
          })();

          setMedia({ bucket: mediaData.bucket, path: normalizedPath, version });
          // Update cache buster with timestamp
          setCacheBuster(Date.now().toString());
        }
      } else {
        setMedia(null);
        lastLoadedVersion.current = null;
      }
    } catch (err) {
      console.error('Error loading fortune media:', err);
      setError(true);
      setMedia(null);
    } finally {
      setLoading(false);
    }
  }, [fortuneId]);

  // Initial load
  useEffect(() => {
    loadMedia();
  }, [fortuneId]); // Only reload on fortuneId change, not on loadMedia

  // Listen for specific photo updates (with updated_at) - immediate refresh
  useEffect(() => {
    interface FortunePhotoUpdatedEvent extends CustomEvent {
      detail: { fortuneId: string; updated_at: string; signedUrl?: string };
    }

    const handlePhotoUpdate = ((e: FortunePhotoUpdatedEvent) => {
      const { fortuneId: eventFortuneId, updated_at, signedUrl: eventSignedUrl } = e.detail;
      
      // Only handle if this is for our fortune
      if (eventFortuneId !== fortuneId) return;
      
      console.log('[FORTUNE-PHOTO] fortunePhotoUpdated received', { fortuneId, updated_at });
      
      // Reset signed URL retry state on explicit photo update
      signedUrlRetryCount.current = 0;
      signedUrlRetryKey.current = null;
      if (signedUrlRetryTimer.current) {
        clearTimeout(signedUrlRetryTimer.current);
        signedUrlRetryTimer.current = null;
      }
      
      // Store immediate signed URL if provided (valid for 5 minutes)
      if (eventSignedUrl) {
        immediateSignedUrlRef.current = {
          url: eventSignedUrl,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        };
      }
      
      // Force immediate refresh
      if (media?.bucket && media?.path) {
        clearSignedUrlCacheFor(media.bucket, media.path);
      }
      setCacheBuster(updated_at || Date.now().toString());
      loadMedia(true);
    }) as EventListener;

    // Listen for general fortune updates - debounced
    const handleFortuneUpdate = () => {
      // Clear any pending reload
      if (pendingReload.current) {
        clearTimeout(pendingReload.current);
      }
      
      // Debounce: wait 300ms before reloading to batch multiple events
      pendingReload.current = setTimeout(() => {
        console.log('[FORTUNE-PHOTO] fortunesUpdated - checking for updates', { fortuneId });
        if (media?.bucket && media?.path) {
          clearSignedUrlCacheFor(media.bucket, media.path);
        }
        loadMedia(true); // Force refresh to check for new version
        pendingReload.current = null;
      }, 300);
    };

    window.addEventListener("fortunePhotoUpdated", handlePhotoUpdate);
    window.addEventListener("fortunesUpdated", handleFortuneUpdate);
    
    return () => {
      window.removeEventListener("fortunePhotoUpdated", handlePhotoUpdate);
      window.removeEventListener("fortunesUpdated", handleFortuneUpdate);
      if (pendingReload.current) {
        clearTimeout(pendingReload.current);
      }
      if (signedUrlRetryTimer.current) {
        clearTimeout(signedUrlRetryTimer.current);
        signedUrlRetryTimer.current = null;
      }
    };
  }, [fortuneId, loadMedia, media]);

  // Update cache buster when photoUpdatedAt prop changes (from parent)
  useEffect(() => {
    if (photoUpdatedAt) {
      console.log('[FORTUNE-PHOTO] photoUpdatedAt prop changed', { fortuneId, photoUpdatedAt });
      setCacheBuster(photoUpdatedAt);
      // Force reload if version changed
      if (photoUpdatedAt !== lastLoadedVersion.current) {
        if (media?.bucket && media?.path) {
          clearSignedUrlCacheFor(media.bucket, media.path);
        }
        loadMedia(true);
      }
    }
  }, [photoUpdatedAt, fortuneId, loadMedia, media]);

  // If we have media but the signed URL is not available yet (e.g. object not found / eventual consistency),
  // retry a few times with exponential backoff. This prevents infinite refresh loops and request spam.
  useEffect(() => {
    if (!media) {
      signedUrlRetryCount.current = 0;
      signedUrlRetryKey.current = null;
      if (signedUrlRetryTimer.current) {
        clearTimeout(signedUrlRetryTimer.current);
        signedUrlRetryTimer.current = null;
      }
      return;
    }

    const key = `${media.bucket}:${media.path}:${media.version}`;

    // Reset retries when media changes
    if (signedUrlRetryKey.current !== key) {
      signedUrlRetryKey.current = key;
      signedUrlRetryCount.current = 0;
      if (signedUrlRetryTimer.current) {
        clearTimeout(signedUrlRetryTimer.current);
        signedUrlRetryTimer.current = null;
      }
    }

    // If signedUrl is available, stop retrying
    if (signedUrl) {
      signedUrlRetryCount.current = 0;
      if (signedUrlRetryTimer.current) {
        clearTimeout(signedUrlRetryTimer.current);
        signedUrlRetryTimer.current = null;
      }
      return;
    }

    // Already scheduled
    if (signedUrlRetryTimer.current) return;

    // Max retries
    const maxRetries = 3;
    if (signedUrlRetryCount.current >= maxRetries) {
      console.warn('[FORTUNE-PHOTO] Signed URL unavailable after max retries; will wait for next update event', {
        fortuneId,
        bucket: media.bucket,
        path: media.path,
        version: media.version,
      });
      return;
    }

    const attempt = signedUrlRetryCount.current + 1;
    const delay = 600 * Math.pow(2, signedUrlRetryCount.current); // 600ms, 1200ms, 2400ms

    console.log('[FORTUNE-PHOTO] Scheduling signed URL retry', { fortuneId, attempt, delay });

    signedUrlRetryTimer.current = setTimeout(() => {
      signedUrlRetryTimer.current = null;
      signedUrlRetryCount.current = attempt;

      // Force a re-render and clear signed URL cache so `useSignedUrl` re-attempts
      clearSignedUrlCacheFor(media.bucket, media.path);
      setCacheBuster(Date.now().toString());
    }, delay);

    return () => {
      if (signedUrlRetryTimer.current) {
        clearTimeout(signedUrlRetryTimer.current);
        signedUrlRetryTimer.current = null;
      }
    };
  }, [media, signedUrl, fortuneId]);

  if (loading && !media) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ aspectRatio: '16/9' }} />
    );
  }

  if (error || !media) {
    return null; // Don't render anything if no photo or error
  }

  // If we have media but no signed URL, show loading
  if (!signedUrl) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ aspectRatio: '16/9' }} />
    );
  }

  // Create cache-busted URL with updated_at or cache buster timestamp
  const imageUrl = (() => {
    const baseUrl = signedUrl || '';
    if (!baseUrl) return '';
    const separator = baseUrl.includes('?') ? '&' : '?';
    // Use version (updated_at) if available, otherwise use cache buster
    // Convert timestamp to numeric if it's a date string for consistent cache busting
    const versionValue = media.version || cacheBuster;
    const versionParam = versionValue.includes('T') ? new Date(versionValue).getTime() : versionValue;
    return `${baseUrl}${separator}v=${versionParam}`;
  })();

  // Use key with updated_at for React to force re-mount when photo updates
  // This ensures the img element is completely recreated, forcing browser to reload image
  const componentKey = media ? `${fortuneId}:${media.version || cacheBuster}` : fortuneId;

  return (
    <img 
      key={componentKey}
      src={imageUrl}
      alt="Fortune attachment" 
      className={`object-cover rounded border border-border/50 ${className}`}
      style={{ aspectRatio: '16/9' }}
      onError={() => {
        // If the signed URL is present but the image fails to load, mark error.
        // Do NOT spam retries here; signed URL retries are handled by the effect above.
        setError(true);

        // Clear immediate signed URL (if any) so we fall back to hook on next render
        immediateSignedUrlRef.current = null;
      }}
    />
  );
};
