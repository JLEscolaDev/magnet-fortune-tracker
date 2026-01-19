import { supabase } from './client';

export interface FortuneMedia {
  id: string;
  fortune_id: string;
  user_id: string;
  bucket: string;
  path: string;
  mime_type: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  created_at: string;
  updated_at: string;
}

const SIGNED_URL_EXPIRY = 300; // 5 minutes

const normalizeStoragePath = (bucket: string, rawPath: string): string => {
  let p = String(rawPath ?? '').trim();
  if (!p) return '';

  while (p.startsWith('/')) p = p.slice(1);

  const q = p.indexOf('?');
  if (q !== -1) p = p.slice(0, q);
  const h = p.indexOf('#');
  if (h !== -1) p = p.slice(0, h);

  const marker1 = `/object/${bucket}/`;
  const marker2 = `/object/public/${bucket}/`;
  const idx1 = p.indexOf(marker1);
  const idx2 = p.indexOf(marker2);
  if (idx1 !== -1) p = p.slice(idx1 + marker1.length);
  else if (idx2 !== -1) p = p.slice(idx2 + marker2.length);

  if (p.startsWith(`${bucket}:`)) p = p.replace(`${bucket}:`, `${bucket}/`);

  if (p.startsWith(`${bucket}/`)) p = p.slice(bucket.length + 1);

  while (p.startsWith('/')) p = p.slice(1);

  const hasSlash = p.includes('/');
  const hasDot = p.split('/').pop()?.includes('.') ?? false;
  if (!hasSlash || !hasDot) return '';

  return p;
};

export const getFortuneMedia = async (fortuneId: string): Promise<FortuneMedia | null> => {
  try {
    const { data, error } = await supabase
      .from('fortune_media')
      .select('*')
      .eq('fortune_id', fortuneId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching fortune media:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching fortune media:', error);
    return null;
  }
};

export const createSignedUrl = async (
  path: string,
  bucket: string = 'photos',
  fortuneId?: string
): Promise<string | null> => {
  const normalizedPath = normalizeStoragePath(bucket, path);
  if (!normalizedPath) {
    console.error('[FORTUNE-PHOTO] Invalid/empty path for signed URL', { bucket, path, normalizedPath });
    return null;
  }

  const MAX_RETRIES = 2;
  const backoffDelays = [300, 600]; // ms for 2 retries
  let lastError: unknown = null;

  console.log('[FORTUNE-PHOTO] Starting createSignedUrl', {
    bucket,
    path: normalizedPath,
    fortuneId: fortuneId || '(none)',
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(normalizedPath, SIGNED_URL_EXPIRY);

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
            bucket,
            path: normalizedPath,
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            backoffMs,
            error: errorMessage,
          });
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        throw error;
      }

      const url = data?.signedUrl ?? null;
      console.log('[FORTUNE-PHOTO] createSignedUrl success', {
        bucket,
        path: normalizedPath,
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
          console.error('[FORTUNE-PHOTO] createSignedUrl final give-up', {
            bucket,
            path: normalizedPath,
            totalAttempts: MAX_RETRIES + 1,
            error: errorMessage,
          });
        } else {
          console.error('[FORTUNE-PHOTO] createSignedUrl failure (no retry)', {
            bucket,
            path: normalizedPath,
            attempt: attempt + 1,
            error: errorMessage,
          });
        }
        break;
      }

      const backoffMs = backoffDelays[attempt];
      console.log('[FORTUNE-PHOTO] createSignedUrl retry scheduled', {
        bucket,
        path: normalizedPath,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        backoffMs,
        error: errorMessage,
      });
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  console.error('[FORTUNE-PHOTO] createSignedUrl final give-up after all retries', {
    bucket,
    path: normalizedPath,
    totalAttempts: MAX_RETRIES + 1,
    lastError: lastError instanceof Error ? lastError.message : String(lastError),
  });
  return null;
};

const signedUrlCache = new Map<string, { url: string; expiry: number }>();

export const getCachedSignedUrl = async (
  path: string,
  bucket?: string,
  fortuneId?: string
): Promise<string | null> => {
  const now = Date.now();
  const b = bucket || 'photos';
  const normalizedPath = normalizeStoragePath(b, path);

  if (!normalizedPath) {
    console.error('[FORTUNE-PHOTO] getCachedSignedUrl: invalid/empty normalized path', { bucket: b, path });
    return null;
  }

  // Stable cache key: no version, no fallback timestamps
  const cacheKey = `${b}:${normalizedPath}`;
  const cached = signedUrlCache.get(cacheKey);

  if (cached && cached.expiry > now + 30000) {
    return cached.url;
  }

  const signedUrl = await createSignedUrl(path, b, fortuneId);
  if (signedUrl) {
    signedUrlCache.set(cacheKey, {
      url: signedUrl,
      expiry: now + SIGNED_URL_EXPIRY * 1000,
    });
  }

  return signedUrl;
};

export const saveFortuneMedia = async (
  mediaData: Omit<FortuneMedia, 'id' | 'created_at' | 'updated_at'>
): Promise<FortuneMedia | null> => {
  try {
    const existing = await getFortuneMedia(mediaData.fortune_id);

    const b = mediaData.bucket || 'photos';
    const nextNormalized = normalizeStoragePath(b, mediaData.path);

    if (!nextNormalized) {
      console.error('saveFortuneMedia: refusing to write invalid path', {
        bucket: b,
        rawPath: mediaData.path,
      });
      return null;
    }

    const toWrite = {
      ...mediaData,
      bucket: b,
      path: nextNormalized,
    };

    const { data, error } = await supabase
      .from('fortune_media')
      .upsert(toWrite, { onConflict: 'fortune_id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving fortune media:', error);
      return null;
    }

    try {
      if (existing) {
        const oldBucket = existing.bucket || 'photos';
        const oldNormalized = normalizeStoragePath(oldBucket, existing.path);
        if (oldNormalized) signedUrlCache.delete(`${oldBucket}:${oldNormalized}`);
      }

      const newBucket = data.bucket || 'photos';
      const newNormalized = normalizeStoragePath(newBucket, data.path);
      if (newNormalized) signedUrlCache.delete(`${newBucket}:${newNormalized}`);

      signedUrlCache.clear();
    } catch (e) {
      console.warn('saveFortuneMedia: cache invalidation failed (ignored)', e);
    }

    return data;
  } catch (error) {
    console.error('Error saving fortune media:', error);
    return null;
  }
};

export const deleteFortuneMedia = async (fortuneId: string): Promise<boolean> => {
  try {
    const existing = await getFortuneMedia(fortuneId);

    const { error } = await supabase
      .from('fortune_media')
      .delete()
      .eq('fortune_id', fortuneId);

    if (error) {
      console.error('Error deleting fortune media:', error);
      return false;
    }

    try {
      if (existing) {
        const b = existing.bucket || 'photos';
        const p = normalizeStoragePath(b, existing.path);
        if (p) signedUrlCache.delete(`${b}:${p}`);
      }
      signedUrlCache.clear();
    } catch (e) {
      console.warn('deleteFortuneMedia: cache invalidation failed (ignored)', e);
    }

    return true;
  } catch (error) {
    console.error('Error deleting fortune media:', error);
    return false;
  }
};