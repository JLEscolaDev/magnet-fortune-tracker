import { supabase } from './client';

export interface FortuneMedia {
  id: string;
  fortune_id: string;
  user_id: string;
  path: string;
  mime_type: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  created_at: string;
}

const SIGNED_URL_EXPIRY = 300; // 5 minutes

export const getFortuneMedia = async (fortuneId: string): Promise<FortuneMedia | null> => {
  try {
    const { data, error } = await supabase
      .from('fortune_media')
      .select('*')
      .eq('fortune_id', fortuneId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No media found
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching fortune media:', error);
    return null;
  }
};

export const createSignedUrl = async (path: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('photos')
      .createSignedUrl(path, SIGNED_URL_EXPIRY);

    if (error) {
      console.error('Error creating signed URL:', error);
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

export const getCachedSignedUrl = async (path: string): Promise<string | null> => {
  const now = Date.now();
  const cached = signedUrlCache.get(path);
  
  // Return cached URL if still valid (with 30s buffer)
  if (cached && cached.expiry > now + 30000) {
    return cached.url;
  }

  // Create new signed URL
  const signedUrl = await createSignedUrl(path);
  if (signedUrl) {
    signedUrlCache.set(path, {
      url: signedUrl,
      expiry: now + (SIGNED_URL_EXPIRY * 1000)
    });
  }

  return signedUrl;
};