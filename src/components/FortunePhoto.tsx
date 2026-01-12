import React, { useState, useEffect, useMemo } from 'react';
import { getFortuneMedia } from '@/integrations/supabase/fortuneMedia';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface FortunePhotoProps {
  fortuneId: string;
  className?: string;
}

type FortuneMediaState = {
  bucket: string;
  path: string;
  // Used to bust browser/CDN cache when the underlying media changes.
  // Prefer DB-driven versioning (e.g., fortune_media.updated_at) when available.
  version: string;
};

export const FortunePhoto: React.FC<FortunePhotoProps> = ({ fortuneId, className = "" }) => {
  const [media, setMedia] = useState<FortuneMediaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // NOTE: `useSignedUrl` is expected to re-run when bucket/path changes.
  const signedUrl = useSignedUrl(media?.bucket, media?.path, 300);

  // Add a deterministic cache-buster so that when the media changes,
  // the <img> src changes and the browser is forced to refetch.
  const signedUrlWithVersion = useMemo(() => {
    if (!signedUrl || !media?.version) return signedUrl;
    const separator = signedUrl.includes('?') ? '&' : '?';
    return `${signedUrl}${separator}v=${encodeURIComponent(media.version)}`;
  }, [signedUrl, media?.version]);

  useEffect(() => {
    let cancelled = false;

    const loadMedia = async () => {
      setLoading(true);
      setError(false);

      try {
        const mediaData: any = await getFortuneMedia(fortuneId);

        if (!mediaData?.path || !mediaData?.bucket) {
          if (!cancelled) setMedia(null);
          return;
        }

        // Prefer a DB-driven version if your query returns it (recommended).
        // Fallback to the path itself, which still changes on replace uploads.
        const version = String(mediaData.updated_at ?? mediaData.updatedAt ?? mediaData.path);

        if (!cancelled) {
          setMedia({
            bucket: String(mediaData.bucket),
            path: String(mediaData.path),
            version,
          });
        }
      } catch (err) {
        console.error('Error loading fortune media:', err);
        if (!cancelled) {
          setError(true);
          setMedia(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMedia();

    return () => {
      cancelled = true;
    };
  }, [fortuneId]);

  if (loading) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ aspectRatio: '16/9' }} />
    );
  }

  if (error || !media) {
    return null; // Don't render anything if no photo or error
  }

  // If we have media but no signed URL, show loading
  if (!signedUrlWithVersion) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ aspectRatio: '16/9' }} />
    );
  }

  return (
    <img
      // Cache-busted signed URL so the browser doesn't keep showing the previous image.
      src={signedUrlWithVersion}
      alt="Fortune attachment"
      className={`object-cover rounded border border-border/50 ${className}`}
      style={{ aspectRatio: '16/9' }}
      onError={() => {
        setError(true);
      }}
    />
  );
};