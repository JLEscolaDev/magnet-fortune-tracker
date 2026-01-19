import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignedUrlCache {
  signedUrl: string;
  expiresAt: number;
}

interface InFlightRequest {
  promise: Promise<string | null>;
  timestamp: number;
}

const urlCache = new Map<string, SignedUrlCache>();
const inFlightRequests = new Map<string, InFlightRequest>();

const cleanupInFlight = () => {
  const now = Date.now();
  for (const [key, request] of inFlightRequests.entries()) {
    if (now - request.timestamp > 30000) {
      inFlightRequests.delete(key);
    }
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeStoragePath(bucket: string, path: string): string {
  if (!path) return path;
  const p = path.startsWith('/') ? path.slice(1) : path;
  const prefix = `${bucket}/`;
  if (p.startsWith(prefix)) {
    return p.slice(prefix.length);
  }
  return p;
}

const createSignedUrlViaEdgeWithRetry = async (
  fortuneId: string,
  ttlSec: number,
  requestKey: string
): Promise<string | null> => {
  const existing = inFlightRequests.get(requestKey);
  if (existing) {
    return existing.promise;
  }

  const promise = (async (): Promise<string | null> => {
    let lastError: unknown;
    const MAX_RETRIES = 2;
    const backoffDelays = [300, 600]; // ms for 2 retries

    console.log('[FORTUNE-PHOTO] Starting edge function fetch', { fortuneId, requestKey, ttlSec });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('finalize-fortune-photo', {
          body: {
            action: 'SIGN_ONLY',
            fortune_id: fortuneId,
            ttlSec,
          },
        });

        if (error) {
          lastError = error;
          throw error;
        }

        const signedUrl = (data as { signedUrl?: string | null } | null)?.signedUrl ?? null;
        console.log('[FORTUNE-PHOTO] Edge function success', {
          requestKey,
          attempt: attempt + 1,
          hasUrl: !!signedUrl,
        });
        return signedUrl;
      } catch (err) {
        lastError = err;
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (attempt < MAX_RETRIES) {
          const backoffMs = backoffDelays[attempt];
          console.log('[FORTUNE-PHOTO] Edge function retry scheduled', {
            requestKey,
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            backoffMs,
            error: errorMessage,
          });
          await sleep(backoffMs);
        }
      }
    }

    console.error('[FORTUNE-PHOTO] Edge function final give-up', {
      requestKey,
      totalAttempts: MAX_RETRIES + 1,
      lastError: lastError instanceof Error ? lastError.message : String(lastError),
    });
    return null;
  })();

  inFlightRequests.set(requestKey, {
    promise,
    timestamp: Date.now(),
  });

  try {
    return await promise;
  } finally {
    inFlightRequests.delete(requestKey);
    cleanupInFlight();
  }
};

const createSignedUrlWithRetry = async (
  bucket: string,
  rawPath: string,
  ttlSec: number,
  requestKey: string
): Promise<string | null> => {
  const existing = inFlightRequests.get(requestKey);
  if (existing) {
    return existing.promise;
  }

  const promise = (async (): Promise<string | null> => {
    let lastError: unknown;
    const MAX_RETRIES = 2;
    const backoffDelays = [300, 600]; // ms for 2 retries

    const path = normalizeStoragePath(bucket, rawPath);

    console.log('[FORTUNE-PHOTO] Starting storage fetch', { bucket, path, requestKey, ttlSec });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, ttlSec);

        if (error) {
          lastError = error;

          const errorMessage = error.message || String(error);
          const isTransientNotFound =
            errorMessage.includes('Object not found') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('404');

          if (isTransientNotFound && attempt < MAX_RETRIES) {
            const backoffMs = backoffDelays[attempt];
            console.log('[FORTUNE-PHOTO] Transient error, retry scheduled', {
              requestKey,
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES,
              backoffMs,
              error: errorMessage,
            });
            await sleep(backoffMs);
            continue;
          }

          throw error;
        }

        const url = data?.signedUrl ?? null;
        console.log('[FORTUNE-PHOTO] Storage success', {
          requestKey,
          attempt: attempt + 1,
          hasUrl: !!url,
        });
        return url;
      } catch (err) {
        lastError = err;
        const errorMessage = err instanceof Error ? err.message : String(err);

        const isTransient =
          errorMessage.includes('Object not found') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('404');

        if (!isTransient || attempt >= MAX_RETRIES) {
          if (attempt >= MAX_RETRIES) {
            console.error('[FORTUNE-PHOTO] Storage final give-up', {
              requestKey,
              totalAttempts: MAX_RETRIES + 1,
              error: errorMessage,
            });
          } else {
            console.error('[FORTUNE-PHOTO] Storage failure (no retry)', {
              requestKey,
              attempt: attempt + 1,
              error: errorMessage,
            });
          }
          break;
        }

        const backoffMs = backoffDelays[attempt];
        console.log('[FORTUNE-PHOTO] Storage retry scheduled', {
          requestKey,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          backoffMs,
          error: errorMessage,
        });
        await sleep(backoffMs);
      }
    }

    console.error('[FORTUNE-PHOTO] Storage final give-up after all retries', {
      requestKey,
      totalAttempts: MAX_RETRIES + 1,
      lastError: lastError instanceof Error ? lastError.message : String(lastError),
    });
    return null;
  })();

  inFlightRequests.set(requestKey, {
    promise,
    timestamp: Date.now()
  });

  try {
    return await promise;
  } finally {
    inFlightRequests.delete(requestKey);
    cleanupInFlight();
  }
};

export function useSignedUrl(
  bucket?: string,
  rawPath?: string,
  ttlSec: number = 300,
  version?: string,
  fortuneId?: string
): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!bucket || !rawPath) {
      setSignedUrl(null);
      return;
    }

    const path = normalizeStoragePath(bucket, rawPath);

    // Stable cache key: only include version if provided (not null/undefined)
    // If version is missing, use stable key without version to avoid retries
    const cacheKey = version ? `${bucket}:${path}:${version}` : `${bucket}:${path}`;

    // When version changes, clear ALL old cache entries for this bucket:path
    if (version) {
      const keysToDelete: string[] = [];
      for (const [k] of urlCache.entries()) {
        if (k === `${bucket}:${path}` || k.startsWith(`${bucket}:${path}:`)) {
          if (k !== cacheKey) keysToDelete.push(k);
        }
      }
      keysToDelete.forEach(k => urlCache.delete(k));
    }

    // Check cache first
    const cached = urlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setSignedUrl(cached.signedUrl);
      return;
    }

    setSignedUrl(null);

    let cancelled = false;

    const signer = fortuneId
      ? createSignedUrlViaEdgeWithRetry(fortuneId, ttlSec, cacheKey)
      : createSignedUrlWithRetry(bucket, path, ttlSec, cacheKey);

    signer
      .then(url => {
        if (cancelled || !isMountedRef.current) return;

        if (url) {
          const expiresAt = Date.now() + (ttlSec * 1000) - 5000;
          urlCache.set(cacheKey, { signedUrl: url, expiresAt });
        }

        setSignedUrl(url);
      })
      .catch(error => {
        if (cancelled || !isMountedRef.current) return;
        console.error('[FORTUNE-PHOTO] Hook error:', error);
        setSignedUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, rawPath, ttlSec, version, fortuneId]);

  return signedUrl;
}

export function clearSignedUrlCache() {
  urlCache.clear();
  inFlightRequests.clear();
}

export function clearSignedUrlCacheFor(bucket: string, rawPath: string) {
  const path = normalizeStoragePath(bucket, rawPath);
  const keysToDelete: string[] = [];
  for (const [k] of urlCache.entries()) {
    if (k === `${bucket}:${path}` || k.startsWith(`${bucket}:${path}:`)) {
      keysToDelete.push(k);
    }
  }
  keysToDelete.forEach(k => urlCache.delete(k));

  const inFlightToDelete: string[] = [];
  for (const [k] of inFlightRequests.entries()) {
    if (k === `${bucket}:${path}` || k.startsWith(`${bucket}:${path}:`)) {
      inFlightToDelete.push(k);
    }
  }
  inFlightToDelete.forEach(k => inFlightRequests.delete(k));
}