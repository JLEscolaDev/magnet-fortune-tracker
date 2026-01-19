import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * FortunePhoto (WEB React component)
 *
 * Fetches a signed GET URL using Supabase Storage API directly.
 * Uses stable cache keys without fallback timestamps to prevent fetch loops.
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

  const inFlightRef = useRef(false);
  const cancelledRef = useRef(false);
  const retryCountRef = useRef(0);

  useEffect(() => {
    cancelledRef.current = false;
    retryCountRef.current = 0;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Stable cache key: only includes version if it's provided (not null/undefined)
  // If version is missing, use a stable key without version to avoid retries
  const cacheKey = useMemo(() => {
    if (!bucket || !path) return null;
    const baseKey = `${fortuneId}::${bucket}::${path}`;
    return version ? `${baseKey}::${version}` : baseKey;
  }, [fortuneId, bucket, path, version]);

  useEffect(() => {
    // No media -> clear and exit
    if (!bucket || !path || !cacheKey) {
      setSignedUrl(null);
      setLoading(false);
      inFlightRef.current = false;
      return;
    }

    // Avoid concurrent requests for the same cache key
    if (inFlightRef.current) {
      console.log('[FORTUNE-PHOTO] Request already in flight, skipping', { cacheKey });
      return;
    }

    const run = async () => {
      inFlightRef.current = true;
      setLoading(true);
      retryCountRef.current = 0;

      const requestedTtl = typeof ttlSec === 'number' && ttlSec > 0 ? ttlSec : 300;

      console.log('[FORTUNE-PHOTO] Starting signed URL fetch', {
        fortuneId,
        bucket,
        path,
        version: version || '(none)',
        cacheKey,
        ttlSec: requestedTtl,
      });

      const MAX_RETRIES = 2;
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (cancelledRef.current) {
          console.log('[FORTUNE-PHOTO] Cancelled during fetch', { cacheKey });
          return;
        }

        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, requestedTtl);

          if (error) {
            lastError = error;

            // Check if this is a transient "Object not found" error that might retry
            const isTransientNotFound =
              error.message?.includes('Object not found') ||
              error.message?.includes('not found') ||
              error.message?.includes('404');

            if (isTransientNotFound && attempt < MAX_RETRIES) {
              const backoffMs = 300 * Math.pow(2, attempt);
              retryCountRef.current = attempt + 1;
              console.log('[FORTUNE-PHOTO] Transient error, scheduling retry', {
                cacheKey,
                attempt: attempt + 1,
                maxRetries: MAX_RETRIES,
                backoffMs,
                error: error.message,
              });

              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }

            throw error;
          }

          if (cancelledRef.current) {
            console.log('[FORTUNE-PHOTO] Cancelled after successful fetch', { cacheKey });
            return;
          }

          const url = data?.signedUrl ?? null;
          console.log('[FORTUNE-PHOTO] Success', {
            cacheKey,
            attempt: attempt + 1,
            hasUrl: !!url,
          });

          setSignedUrl(url);
          setLoading(false);
          inFlightRef.current = false;
          return;
        } catch (err) {
          lastError = err;

          // Non-transient errors: give up immediately
          const errorMessage = err instanceof Error ? err.message : String(err);
          const isTransient =
            errorMessage.includes('Object not found') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('404');

          if (!isTransient || attempt >= MAX_RETRIES) {
            console.error('[FORTUNE-PHOTO] Failure (no retry)', {
              cacheKey,
              attempt: attempt + 1,
              error: errorMessage,
            });
            break;
          }

          const backoffMs = 300 * Math.pow(2, attempt);
          retryCountRef.current = attempt + 1;
          console.log('[FORTUNE-PHOTO] Retry scheduled', {
            cacheKey,
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            backoffMs,
            error: errorMessage,
          });

          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }

      // All retries exhausted
      console.error('[FORTUNE-PHOTO] Final give-up after all retries', {
        cacheKey,
        totalAttempts: MAX_RETRIES + 1,
        lastError: lastError instanceof Error ? lastError.message : String(lastError),
      });

      if (cancelledRef.current) return;

      setSignedUrl(null);
      setLoading(false);
      inFlightRef.current = false;
    };

    run();
  }, [cacheKey, fortuneId, bucket, path, ttlSec, version]);

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