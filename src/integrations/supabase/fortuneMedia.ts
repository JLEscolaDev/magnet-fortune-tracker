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

// Storage paths in DB must be bucket-relative, but legacy rows may include `photos/` prefix or full URLs.
// Normalize everything to a bucket-relative path that Supabase Storage expects.
const normalizeStoragePath = (bucket: string, rawPath: string): string => {
  let p = String(rawPath ?? '').trim();
  if (!p) return '';

  // Remove leading slashes
  while (p.startsWith('/')) p = p.slice(1);

  // Strip query/hash
  const q = p.indexOf('?');
  if (q !== -1) p = p.slice(0, q);
  const h = p.indexOf('#');
  if (h !== -1) p = p.slice(0, h);

  // If a full URL is passed, extract the part after `/object/<bucket>/` or `/object/public/<bucket>/`
  // Example: https://.../storage/v1/object/public/photos/<path>
  const marker1 = `/object/${bucket}/`;
  const marker2 = `/object/public/${bucket}/`;
  const idx1 = p.indexOf(marker1);
  const idx2 = p.indexOf(marker2);
  if (idx1 !== -1) p = p.slice(idx1 + marker1.length);
  else if (idx2 !== -1) p = p.slice(idx2 + marker2.length);

  // Handle weird `bucket:path` format
  if (p.startsWith(`${bucket}:`)) p = p.replace(`${bucket}:`, `${bucket}/`);

  // Strip bucket prefix if present (legacy DB rows sometimes store `photos/<path>`)
  if (p.startsWith(`${bucket}/`)) p = p.slice(bucket.length + 1);

  // Final cleanup
  while (p.startsWith('/')) p = p.slice(1);

  // Defensive guard: avoid returning just a userId or an obviously invalid path
  // We expect at least one `/` (userId/filename) and a filename with an extension.
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
  try {
    // Prefer edge function signing when we know the fortune id.
    // This avoids calling Storage signing endpoints from the client, which can return 400/"Object not found" in some setups.
    if (fortuneId) {
      const { data, error } = await supabase.functions.invoke('finalize-fortune-photo', {
        body: {
          action: 'SIGN_ONLY',
          fortune_id: fortuneId,
          ttlSec: SIGNED_URL_EXPIRY,
        },
      });

      if (error) {
        console.error('Error creating signed URL via edge function:', { fortuneId, error });
        return null;
      }

      return (data as { signedUrl?: string | null } | null)?.signedUrl ?? null;
    }

    const normalizedPath = normalizeStoragePath(bucket, path);
    if (!normalizedPath) {
      console.error('Error creating signed URL: invalid/empty path', { bucket, path, normalizedPath });
      return null;
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(normalizedPath, SIGNED_URL_EXPIRY);

    if (error) {
      console.error('Error creating signed URL:', { bucket, path, normalizedPath, error });
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
};

// Simple cache for signed URLs with TTL
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
    console.error('getCachedSignedUrl: invalid/empty normalized path', { bucket: b, path });
    return null;
  }

  const cacheKey = `${b}:${normalizedPath}`;
  const cached = signedUrlCache.get(cacheKey);

  // Return cached URL if still valid (with 30s buffer)
  if (cached && cached.expiry > now + 30000) {
    return cached.url;
  }

  // Create new signed URL (pass raw path; createSignedUrl will normalize again defensively)
  const signedUrl = await createSignedUrl(path, b, fortuneId);
  if (signedUrl) {
    signedUrlCache.set(cacheKey, {
      url: signedUrl,
      expiry: now + SIGNED_URL_EXPIRY * 1000,
    });
  }

  return signedUrl;
};

// Function to save fortune media record
export const saveFortuneMedia = async (
  mediaData: Omit<FortuneMedia, 'id' | 'created_at' | 'updated_at'>
): Promise<FortuneMedia | null> => {
  try {
    // Read current media first so we can invalidate the right cache entry.
    // NOTE: Without `onConflict`, upsert would INSERT new rows because `id` isn't provided.
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

    // Always store bucket-relative path in DB.
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

    // Invalidate cache for old + new path to prevent showing the previous image.
    try {
      if (existing) {
        const oldBucket = existing.bucket || 'photos';
        const oldNormalized = normalizeStoragePath(oldBucket, existing.path);
        if (oldNormalized) signedUrlCache.delete(`${oldBucket}:${oldNormalized}`);
      }

      const newBucket = data.bucket || 'photos';
      const newNormalized = normalizeStoragePath(newBucket, data.path);
      if (newNormalized) signedUrlCache.delete(`${newBucket}:${newNormalized}`);

      // Also clear any remaining cache entries for safety (small map, cheap).
      // This prevents stale signed URLs when path contracts change.
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

    // Invalidate cache so the UI doesn't keep rendering the previous signed URL.
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