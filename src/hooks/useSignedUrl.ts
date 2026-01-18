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

// Cache for signed URLs with expiry (keyed by bucket:path:version)
const urlCache = new Map<string, SignedUrlCache>();

// Track in-flight requests to dedupe concurrent calls (keyed by bucket:path:version)
const inFlightRequests = new Map<string, InFlightRequest>();

// Clean up old in-flight requests (older than 30 seconds)
const cleanupInFlight = () => {
  const now = Date.now();
  for (const [key, request] of inFlightRequests.entries()) {
    if (now - request.timestamp > 30000) {
      inFlightRequests.delete(key);
    }
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Normalize a storage path to be bucket-relative.
// If callers accidentally pass "photos/<path>" (or "/photos/<path>"), strip the bucket prefix.
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
  // Check if there's already an in-flight request for this exact key
  const existing = inFlightRequests.get(requestKey);
  if (existing) {
    return existing.promise;
  }

  const promise = (async (): Promise<string | null> => {
    let lastError: unknown;
    const backoffDelays = [300, 600, 1200]; // ms

    for (let attempt = 0; attempt < 3; attempt++) {
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
        return signedUrl;
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          await sleep(backoffDelays[attempt]);
        }
      }
    }

    console.error(`Failed to create signed URL via edge for ${requestKey} after 3 attempts:`, lastError);
    return null;
  })();

  // Store the promise to dedupe concurrent requests
  inFlightRequests.set(requestKey, {
    promise,
    timestamp: Date.now(),
  });

  try {
    return await promise;
  } finally {
    // Clean up this request and old ones
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
  // Check if there's already an in-flight request for this exact key
  const existing = inFlightRequests.get(requestKey);
  if (existing) {
    return existing.promise;
  }

  const promise = (async (): Promise<string | null> => {
    let lastError: unknown;
    const backoffDelays = [300, 600, 1200]; // ms

    const path = normalizeStoragePath(bucket, rawPath);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, ttlSec);

        if (error) {
          lastError = error;

          // If it's a "Object not found" error, retry with backoff (eventual consistency)
          if (error.message?.includes('Object not found') || error.message?.includes('not found')) {
            if (attempt < 2) {
              await sleep(backoffDelays[attempt]);
              continue;
            }
          }

          throw error;
        }

        return data?.signedUrl ?? null;
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          await sleep(backoffDelays[attempt]);
        }
      }
    }

    console.error(`Failed to create signed URL for ${requestKey} after 3 attempts:`, lastError);
    return null;
  })();

  // Store the promise to dedupe concurrent requests
  inFlightRequests.set(requestKey, {
    promise,
    timestamp: Date.now()
  });

  try {
    return await promise;
  } finally {
    // Clean up this request and old ones
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

    // Always key cache + in-flight by versioned key (when provided)
    const cacheKey = version ? `${bucket}:${path}:${version}` : `${bucket}:${path}`;

    // When version changes, clear ALL old cache entries for this bucket:path
    // This ensures we always get fresh URLs after photo updates.
    if (version) {
      const keysToDelete: string[] = [];
      for (const [k] of urlCache.entries()) {
        // Match both versioned and unversioned historical keys for this object
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

    // Clear any existing signed URL while loading to prevent stale display
    setSignedUrl(null);

    let cancelled = false;

    const signer = fortuneId
      ? createSignedUrlViaEdgeWithRetry(fortuneId, ttlSec, cacheKey)
      : createSignedUrlWithRetry(bucket, path, ttlSec, cacheKey);

    signer
      .then(url => {
        if (cancelled || !isMountedRef.current) return;

        if (url) {
          // Cache the result with a 5s guard-band
          const expiresAt = Date.now() + (ttlSec * 1000) - 5000;
          urlCache.set(cacheKey, { signedUrl: url, expiresAt });
        }

        setSignedUrl(url);
      })
      .catch(error => {
        if (cancelled || !isMountedRef.current) return;
        console.error('Error getting signed URL:', error);
        setSignedUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, rawPath, ttlSec, version, fortuneId]);

  return signedUrl;
}

// Export function to clear all cached URLs (useful after photo updates)
export function clearSignedUrlCache() {
  urlCache.clear();
  inFlightRequests.clear();
}

// Optional helper: clear cache entries for a specific object (bucket + path)
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
