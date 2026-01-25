import { useEffect, useMemo, useState } from 'react';
import { createSignedUrlViaEdgeWithRetry, getFortuneMedia, type FortuneMedia } from '@/integrations/supabase/fortuneMedia';

export type FortunePhotoProps = {
  fortuneId: string;
  media:
    | {
        bucket?: string | null;
        path?: string | null;
        version?: string | null;
      }
    | null
    | undefined;
  alt?: string;
  className?: string;
  ttlSec?: number;
  onSignedUrl?: (url: string | null) => void;
};

export function useSignedUrl(input: FortuneMedia | null, ttlSec: number = 300): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const key = useMemo(() => {
    if (!input) return null;
    // include version in the key so cache invalidates when updated_at/version changes
    return `${input.bucket}|${input.path}|${input.version ?? ''}|${input.fortuneId ?? ''}`;
  }, [input]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!input || !key) {
        setSignedUrl(null);
        return;
      }

      const url = await createSignedUrlViaEdgeWithRetry({
        bucket: input.bucket,
        path: input.path,
        ttlSec,
        version: input.version ?? null,
        fortuneId: input.fortuneId ?? null,
      });

      if (cancelled) return;
      setSignedUrl(url);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [input, key, ttlSec]);

  return signedUrl;
}

export function FortunePhoto(props: FortunePhotoProps) {
  const { fortuneId, media, alt = 'Fortune photo', className, ttlSec = 300, onSignedUrl } = props;

  const normalized = useMemo(() => {
    return getFortuneMedia({
      fortuneId,
      bucket: media?.bucket ?? 'photos',
      path: media?.path ?? null,
      version: media?.version ?? null,
    });
  }, [fortuneId, media?.bucket, media?.path, media?.version]);

  const signedUrl = useSignedUrl(normalized, ttlSec);

  useEffect(() => {
    onSignedUrl?.(signedUrl);
  }, [signedUrl, onSignedUrl]);

  if (!normalized || !signedUrl) return null;

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}