import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getFortuneMedia } from '@/integrations/supabase/fortuneMedia';
import { useSignedUrl, clearSignedUrlCache } from '@/hooks/useSignedUrl';

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
  }, [fortuneId, media]);

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
      
      // Store immediate signed URL if provided (valid for 5 minutes)
      if (eventSignedUrl) {
        immediateSignedUrlRef.current = {
          url: eventSignedUrl,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        };
      }
      
      // Force immediate refresh
      clearSignedUrlCache();
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
        clearSignedUrlCache();
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
    };
  }, [fortuneId, loadMedia]);

  // Update cache buster when photoUpdatedAt prop changes (from parent)
  useEffect(() => {
    if (photoUpdatedAt) {
      console.log('[FORTUNE-PHOTO] photoUpdatedAt prop changed', { fortuneId, photoUpdatedAt });
      setCacheBuster(photoUpdatedAt);
      // Force reload if version changed
      if (photoUpdatedAt !== lastLoadedVersion.current) {
        clearSignedUrlCache();
        loadMedia(true);
      }
    }
  }, [photoUpdatedAt, fortuneId, loadMedia]);

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
        setError(true);
      }}
    />
  );
};
