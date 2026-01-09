import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignedUrlCache {
  signedUrl: string;
  expiresAt: number;
}

interface InFlightRequest {
  promise: Promise<string | null>;
  timestamp: number;
}

// Cache for signed URLs with expiry
const urlCache = new Map<string, SignedUrlCache>();

// Track in-flight requests to dedupe concurrent calls
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

const createSignedUrlWithRetry = async (bucket: string, path: string, ttlSec: number): Promise<string | null> => {
  const key = `${bucket}:${path}`;
  
  // Check if there's already an in-flight request
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing.promise;
  }

  const promise = (async (): Promise<string | null> => {
    let lastError: Error | unknown;
    const backoffDelays = [300, 600, 1200]; // ms
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, ttlSec);

        if (error) {
          lastError = error;
          // If it's a "Object not found" error (400), retry with backoff
          if (error.message?.includes('Object not found') || error.message?.includes('not found')) {
            if (attempt < 2) {
              await sleep(backoffDelays[attempt]);
              continue;
            }
          }
          throw error;
        }

        if (data?.signedUrl) {
          // Cache the result with 5s guard-band
          const expiresAt = Date.now() + (ttlSec * 1000) - 5000;
          urlCache.set(key, {
            signedUrl: data.signedUrl,
            expiresAt
          });
          
          return data.signedUrl;
        }
        
        return null;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await sleep(backoffDelays[attempt]);
        }
      }
    }
    
    console.error(`Failed to create signed URL for ${key} after 3 attempts:`, lastError);
    return null;
  })();

  // Store the promise to dedupe concurrent requests
  inFlightRequests.set(key, {
    promise,
    timestamp: Date.now()
  });

  try {
    const result = await promise;
    return result;
  } finally {
    // Clean up this request and old ones
    inFlightRequests.delete(key);
    cleanupInFlight();
  }
};

export function useSignedUrl(bucket?: string, path?: string, ttlSec: number = 300): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bucket || !path) {
      setSignedUrl(null);
      return;
    }

    const key = `${bucket}:${path}`;
    
    // Check cache first
    const cached = urlCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      setSignedUrl(cached.signedUrl);
      return;
    }

    // Need to fetch new signed URL
    setLoading(true);
    createSignedUrlWithRetry(bucket, path, ttlSec)
      .then(url => {
        setSignedUrl(url);
      })
      .catch(error => {
        console.error('Error getting signed URL:', error);
        setSignedUrl(null);
      })
      .finally(() => {
        setLoading(false);
      });

  }, [bucket, path, ttlSec]);

  return signedUrl;
}