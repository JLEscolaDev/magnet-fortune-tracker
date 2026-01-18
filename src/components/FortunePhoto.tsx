import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * FortunePhoto (WEB React component)
 *
 * Fetches a signed GET URL through the `finalize-fortune-photo` Edge Function
 * using action: `SIGN_ONLY`.
 */

type FortunePhotoProps = {
  fortuneId: string;
  bucket?: string | null;
  path?: string | null;
  version?: string | null; // fortune_media.updated_at (or similar) for cache busting
  className?: string;
  alt?: string;
  ttlSec?: number; // default 300
};

type SignOnlyResponse = {
  signedUrl: string | null;
  media: {
    fortune_id: string;
    bucket: string;
    path: string;
    updated_at: string;
  } | null;
  buildTag?: string;
};

export default function FortunePhoto({
  fortuneId,
  bucket,
  path,
  version,
  className,
  alt,
  ttlSec,
}: FortunePhotoProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prevent overlapping requests + infinite loops
  const inFlightRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const mediaKey = useMemo(() => {
    return `${fortuneId}::${bucket ?? ''}::${path ?? ''}::${version ?? ''}`;
  }, [fortuneId, bucket, path, version]);

  useEffect(() => {
    // No media -> clear and exit
    if (!bucket || !path) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    // Avoid request storms
    if (inFlightRef.current) return;

    const run = async () => {
      inFlightRef.current = true;
      setLoading(true);

      try {
        const requestedTtl = typeof ttlSec === 'number' && ttlSec > 0 ? ttlSec : 300;

        const { data, error } = await supabase.functions.invoke<SignOnlyResponse>(
          'finalize-fortune-photo',
          {
            body: {
              action: 'SIGN_ONLY',
              fortune_id: fortuneId,
              ttlSec: requestedTtl,
            },
          }
        );

        if (error) throw new Error(error.message || 'Failed to sign photo');

        if (cancelledRef.current) return;

        setSignedUrl(data?.signedUrl ?? null);
        setLoading(false);
      } catch {
        if (cancelledRef.current) return;
        setSignedUrl(null);
        setLoading(false);
      } finally {
        inFlightRef.current = false;
      }
    };

    run();
  }, [mediaKey, fortuneId, bucket, path, ttlSec]);

  if (!bucket || !path) return null;

  if (loading && !signedUrl) {
    return <div className={className} aria-busy="true" />;
  }

  if (!signedUrl) return null;

  return (
    <img
      className={className}
      src={signedUrl}
      alt={alt ?? 'Fortune photo'}
      loading="lazy"
      decoding="async"
    />
  );
}