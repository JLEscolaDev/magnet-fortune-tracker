import React, { useState, useEffect, useCallback } from 'react';
import { getFortuneMedia } from '@/integrations/supabase/fortuneMedia';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface FortunePhotoProps {
  fortuneId: string;
  className?: string;
}

export const FortunePhoto: React.FC<FortunePhotoProps> = ({ fortuneId, className = "" }) => {
  const [media, setMedia] = useState<{ bucket: string; path: string; version: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Pass version to useSignedUrl for cache-busting
  const signedUrl = useSignedUrl(media?.bucket, media?.path, 300, media?.version);

  // Log when rendering with media data (for debugging refresh issues)
  useEffect(() => {
    if (media) {
      console.log('[FORTUNE-LIST] FortunePhoto rendering in Today\'s Fortunes', {
        fortuneId,
        bucket: media.bucket,
        path: media.path,
        updated_at: media.version
      });
    }
  }, [fortuneId, media?.bucket, media?.path, media?.version]);

  const loadMedia = useCallback(async () => {
    try {
      setError(false);
      const mediaData = await getFortuneMedia(fortuneId);
      if (mediaData?.path && mediaData?.bucket) {
        // Use updated_at as version for cache-busting
        const version = mediaData.updated_at || mediaData.created_at || Date.now().toString();
        setMedia({ bucket: mediaData.bucket, path: mediaData.path, version });
      } else {
        setMedia(null);
      }
    } catch (err) {
      console.error('Error loading fortune media:', err);
      setError(true);
      setMedia(null);
    } finally {
      setLoading(false);
    }
  }, [fortuneId]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // Listen for fortune updates to refetch media when photo changes
  useEffect(() => {
    const handleFortuneUpdate = () => {
      console.log('[FORTUNE-PHOTO] fortunesUpdated event received - refetching media', { fortuneId });
      loadMedia();
    };

    window.addEventListener("fortunesUpdated", handleFortuneUpdate);
    return () => {
      window.removeEventListener("fortunesUpdated", handleFortuneUpdate);
    };
  }, [loadMedia, fortuneId]);

  if (loading) {
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
