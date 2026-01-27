import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FortunePhotoProps = {
  fortuneId: string;
  /**
   * Optional cache-busting version (usually fortune_media.updated_at)
   * Changing this forces the hook to re-fetch a new signed URL.
   */
  version?: string;
  alt?: string;
  className?: string;
  ttlSec?: number;
  onSignedUrl?: (url: string | null) => void;
};

function useSignedUrlByFortuneId(fortuneId: string, version?: string, ttlSec: number = 300): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const key = useMemo(() => {
    if (!fortuneId) return null;
    return `${fortuneId}|${version ?? ''}|${ttlSec}`;
  }, [fortuneId, version, ttlSec]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!fortuneId || !key) {
        setSignedUrl(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke('finalize-fortune-photo', {
        body: {
          action: 'SIGN_ONLY',
          fortune_id: fortuneId,
          ttlSec,
        },
      });

      if (cancelled) return;

      if (error) {
        console.error('[FORTUNE_PHOTO] SIGN_ONLY error:', error);
        setSignedUrl(null);
        return;
      }

      const url = (data as { signedUrl?: string | null } | null)?.signedUrl ?? null;
      setSignedUrl(url);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [fortuneId, key, ttlSec]);

  return signedUrl;
}

export function FortunePhoto(props: FortunePhotoProps) {
  const { fortuneId, version, alt = 'Fortune photo', className, ttlSec = 300, onSignedUrl } = props;

  const signedUrl = useSignedUrlByFortuneId(fortuneId, version, ttlSec);

  useEffect(() => {
    onSignedUrl?.(signedUrl);
  }, [signedUrl, onSignedUrl]);

  if (!signedUrl) return null;

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