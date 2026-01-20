import { useEffect, useMemo, useRef, useState } from 'react';
import { createSignedUrlViaEdgeWithRetry } from '@/integrations/supabase/fortuneMedia';

/**
 * useSignedUrl
 *
 * React hook that returns a signed GET URL for a Supabase Storage object.
 *
 * IMPORTANT:
 * - This hook MUST NOT call Supabase Storage signing endpoints from the browser.
 * - It delegates signing to the `finalize-fortune-photo` Edge Function.
 */

type CacheEntry = {
  url: string;
  expiresAt: number;
};

// Simple in-memory cache to avoid re-signing on every render.
const signedUrlCache = new Map<string, CacheEntry>();

function nowMs(): number {
  return Date.now();
}

function cacheKey(bucket: string, path: string, version?: string | null): string {
  return `${bucket}::${path}::${version ?? ''}`;
}

export function useSignedUrl(
  bucket: string,
  path: string | undefined,
  ttlSec: number,
  version?: string,
  fortuneId?: string,
): string | null {
  const key = useMemo(() => {
    if (!path) return null;
    return cacheKey(bucket, path, version ?? null);
  }, [bucket, path, version]);

  const [signedUrl, setSignedUrl] = useState<string | null>(() => {
    if (!key) return null;
    const entry = signedUrlCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= nowMs()) {
      signedUrlCache.delete(key);
      return null;
    }
    return entry.url;
  });

  const inflightRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (!key || !path) {
      setSignedUrl(null);
      return;
    }

    // Serve from cache if still valid.
    const cached = signedUrlCache.get(key);
    if (cached && cached.expiresAt > nowMs()) {
      setSignedUrl(cached.url);
      return;
    }

    // Avoid duplicate requests for the same key.
    if (inflightRef.current) {
      inflightRef.current.then((url) => setSignedUrl(url));
      return;
    }

    const p = createSignedUrlViaEdgeWithRetry({
      bucket,
      path,
      ttlSec,
      version: version ?? null,
      fortuneId: fortuneId ?? null,
    }).then((url) => {
      inflightRef.current = null;

      if (url) {
        // Cache slightly less than TTL to reduce edge cases.
        const safeTtlMs = Math.max(5_000, ttlSec * 1000 - 5_000);
        signedUrlCache.set(key, { url, expiresAt: nowMs() + safeTtlMs });
      } else {
        // No URL returned - file likely doesn't exist (orphaned record)
        // This is expected for deleted/failed uploads - just clear cache
        signedUrlCache.delete(key);
      }

      setSignedUrl(url);

      return url;
    }).catch(() => {
      // Silently handle errors - these are expected for orphaned records
      inflightRef.current = null;
      signedUrlCache.delete(key);
      setSignedUrl(null);
      return null;
    });

    inflightRef.current = p;

    return () => {
      // No-op: we let inflight resolve; component may unmount.
    };
  }, [bucket, key, path, ttlSec, version, fortuneId]);

  return signedUrl;
}