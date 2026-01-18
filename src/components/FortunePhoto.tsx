import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getFortuneMedia } from '@/integrations/supabase/fortuneMedia';
import { useSignedUrl, clearSignedUrlCache } from '@/hooks/useSignedUrl';

interface FortunePhotoProps {
  fortuneId: string;
  className?: string;
}

export const FortunePhoto: React.FC<FortunePhotoProps> = ({ fortuneId, className = "" }) => {
  const [media, setMedia] = useState<{ bucket: string; path: string; version: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Track the last loaded version to prevent unnecessary reloads
  const lastLoadedVersion = useRef<string | null>(null);
  // Track if a reload is pending to debounce multiple events
  const pendingReload = useRef<NodeJS.Timeout | null>(null);

  // Pass version to useSignedUrl for cache-busting
  const signedUrl = useSignedUrl(media?.bucket, media?.path, 300, media?.version);

  const loadMedia = useCallback(async (forceRefresh = false) => {
    try {
      setError(false);
      if (!media) {
        setLoading(true);
      }
      
      const mediaData = await getFortuneMedia(fortuneId);
      
      if (mediaData?.path && mediaData?.bucket) {
        const version = mediaData.updated_at || mediaData.created_at || '';
        
        // Only update state if version changed or force refresh
        if (forceRefresh || version !== lastLoadedVersion.current) {
          console.log('[FORTUNE-PHOTO] loadMedia - updating state:', { 
            fortuneId, 
            path: mediaData.path, 
            version,
            previousVersion: lastLoadedVersion.current 
          });
          lastLoadedVersion.current = version;
          setMedia({ bucket: mediaData.bucket, path: mediaData.path, version });
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
  }, [fortuneId, media]);

  // Initial load
  useEffect(() => {
    loadMedia();
  }, [fortuneId]); // Only reload on fortuneId change, not on loadMedia

  // Listen for fortune updates - debounced to prevent cascading refreshes
  useEffect(() => {
    const handleFortuneUpdate = () => {
      // Clear any pending reload
      if (pendingReload.current) {
        clearTimeout(pendingReload.current);
      }
      
      // Debounce: wait 300ms before reloading to batch multiple events
      pendingReload.current = setTimeout(() => {
        console.log('[FORTUNE-PHOTO] fortunesUpdated - checking for updates', { fortuneId });
        clearSignedUrlCache();
        loadMedia(true); // Force refresh to check for new version
        pendingReload.current = null;
      }, 300);
    };

    window.addEventListener("fortunesUpdated", handleFortuneUpdate);
    return () => {
      window.removeEventListener("fortunesUpdated", handleFortuneUpdate);
      if (pendingReload.current) {
        clearTimeout(pendingReload.current);
      }
    };
  }, [fortuneId, loadMedia]);

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

  return (
    <img 
      src={`${signedUrl}${signedUrl.includes('?') ? '&' : '?'}v=${media.version}`}
      alt="Fortune attachment" 
      className={`object-cover rounded border border-border/50 ${className}`}
      style={{ aspectRatio: '16/9' }}
      onError={() => {
        setError(true);
      }}
    />
  );
};
