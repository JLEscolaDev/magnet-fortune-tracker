import { supabase } from '@/integrations/supabase/client';


/**
 * fortuneMedia
 *
 * Browser-side helper that requests signed GET URLs via the Edge Function.
 *
 * IMPORTANT:
 * - Never call `storage/v1/object/sign` from the browser.
 * - Always use the Edge Function `finalize-fortune-photo` (action: SIGN_ONLY).
 */

export type FortuneMedia = {
  fortuneId?: string | null;
  bucket: string;
  path: string;
  version?: string | null;
};

/**
 * getFortuneMedia
 *
 * Normalizes the media info coming from DB/UI into a stable shape.
 * This exists because multiple call sites pass slightly different payloads.
 */
export function getFortuneMedia(
  input:
    | {
        fortuneId?: string | null;
        bucket?: string | null;
        path?: string | null;
        version?: string | null;
      }
    | null
    | undefined,
): FortuneMedia | null {
  if (!input) return null;

  const bucket = (input.bucket ?? 'photos') as string;
  const rawPath = input.path ?? null;
  if (!rawPath) return null;

  return {
    fortuneId: input.fortuneId ?? null,
    bucket,
    path: normalizePath(bucket, rawPath),
    version: input.version ?? null,
  };
}

type CreateSignedUrlParams = {
  bucket: string;
  path: string;
  ttlSec: number;
  version?: string | null;
  fortuneId?: string | null;
};

type EdgeSignOnlyResponse = {
  signedUrl: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePath(bucket: string, path: string): string {
  // Accept a few common formats and always return bucket-relative path.
  // Examples:
  // - "photos/user/file.jpg" -> "user/file.jpg"
  // - "/photos/user/file.jpg" -> "user/file.jpg"
  // - "user/file.jpg" -> "user/file.jpg"

  const p = path.trim();

  const pref1 = `${bucket}/`;
  const pref2 = `/${bucket}/`;

  if (p.startsWith(pref1)) return p.slice(pref1.length);
  if (p.startsWith(pref2)) return p.slice(pref2.length);

  return p.startsWith('/') ? p.slice(1) : p;
}

/**
 * Requests a signed URL via Edge Function.
 * Retries because the object may be uploaded milliseconds after DB update.
 */
export async function createSignedUrlViaEdgeWithRetry(
  params: CreateSignedUrlParams,
): Promise<string | null> {
  const { bucket, path, ttlSec, version, fortuneId } = params;

  const normalizedPath = normalizePath(bucket, path);

  // 3 attempts with exponential backoff: 0ms, 600ms, 1200ms
  const delays = [0, 600, 1200];

  let lastError: unknown = null;

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      await sleep(delays[i]);
    }

    try {
      const { data, error } = await supabase.functions.invoke<EdgeSignOnlyResponse>(
        'finalize-fortune-photo',
        {
          body: {
            action: 'SIGN_ONLY',
            fortune_id: fortuneId ?? null,
            bucket,
            path: normalizedPath,
            ttlSec,
            version: version ?? null,
          },
        },
      );

      if (error) {
        lastError = error;
        continue;
      }

      const signedUrl = data?.signedUrl ?? null;
      if (signedUrl) {
        return signedUrl;
      }

      // If function responded but without a URL, retry.
      lastError = new Error('Edge function returned no signedUrl');
    } catch (e) {
      lastError = e;
    }
  }

  // Keep console noise low in production, but useful in dev.
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[FORTUNE-PHOTO] Failed to sign via Edge after retries', {
      bucket,
      path,
      normalizedPath,
      ttlSec,
      version,
      fortuneId,
      lastError,
    });
  }

  return null;
}
// Note: exports are provided via `export function ...` and `export type ...` above.