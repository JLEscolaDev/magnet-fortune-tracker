import { useEffect, useMemo, useState } from 'react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { getFortuneMedia, type FortuneMedia } from '@/integrations/supabase/fortuneMedia';

/**
 * FortunePhoto (WEB React component)
 *
 * IMPORTANT:
 * - Do NOT call Supabase Storage signing endpoints from the browser.
 * - Always obtain a signed GET URL via the `finalize-fortune-photo` Edge Function (action: SIGN_ONLY).
 *
 * This component delegates signing + caching to `useSignedUrl`.
 * If no path is provided, it fetches the media info from the database.
 */

type FortunePhotoProps = {
  fortuneId: string;
  bucket?: string | null;
  path?: string | null;
  version?: string | null;
  className?: string;
  alt?: string;
  ttlSec?: number;
};

export function FortunePhoto({
  fortuneId,
  bucket,
  path,
  version,
  className,
  alt,
  ttlSec = 300,
}: FortunePhotoProps) {
  // State to hold media info fetched from DB when path is not provided
  const [mediaInfo, setMediaInfo] = useState<FortuneMedia | null>(null);
  const [loading, setLoading] = useState(!path);

  // Fetch media info from DB if path is not provided
  useEffect(() => {
    if (path) {
      // Path is provided directly, no need to fetch
      setLoading(false);
      return;
    }

    let cancelled = false;
    
    const fetchMedia = async () => {
      try {
        const media = await getFortuneMedia(fortuneId);
        if (!cancelled) {
          setMediaInfo(media);
          setLoading(false);
        }
      } catch (error) {
        console.error('[FortunePhoto] Error fetching media:', error);
        if (!cancelled) {
          setMediaInfo(null);
          setLoading(false);
        }
      }
    };

    fetchMedia();

    return () => {
      cancelled = true;
    };
  }, [fortuneId, path]);

  // Use provided props or fetched media info
  const effectiveBucket = useMemo(() => (bucket ?? mediaInfo?.bucket ?? 'photos') as string, [bucket, mediaInfo?.bucket]);
  const effectivePath = useMemo(() => (path ?? mediaInfo?.path ?? undefined) as string | undefined, [path, mediaInfo?.path]);
  const effectiveVersion = useMemo(() => (version ?? mediaInfo?.updatedAt ?? undefined) as string | undefined, [version, mediaInfo?.updatedAt]);

  const signedUrl = useSignedUrl(effectiveBucket, effectivePath, ttlSec, effectiveVersion, fortuneId);

  // If still loading media info, show placeholder
  if (loading) {
    return <div className={className} aria-busy="true" />;
  }

  // If we don't have a path, we can't render anything (no media exists).
  if (!effectivePath) {
    return null;
  }

  // While loading signed URL, show a lightweight placeholder to avoid layout jumps.
  if (!signedUrl) {
    return <div className={className} aria-busy="true" style={{ minHeight: '100px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }} />;
  }

  return (
    <img
      className={className}
      src={signedUrl}
      alt={alt ?? 'Fortune photo'}
      loading="lazy"
      decoding="async"
      style={{ borderRadius: '8px' }}
    />
  );
}

export default FortunePhoto;