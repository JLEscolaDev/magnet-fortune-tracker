import { useMemo } from 'react';
import { useSignedUrl } from '@/hooks/useSignedUrl';

/**
 * FortunePhoto (WEB React component)
 *
 * IMPORTANT:
 * - Do NOT call Supabase Storage signing endpoints from the browser.
 * - Always obtain a signed GET URL via the `finalize-fortune-photo` Edge Function (action: SIGN_ONLY).
 *
 * This component delegates signing + caching to `useSignedUrl`.
 */

type FortunePhotoProps = {
  fortuneId: string;
  bucket?: string | null;
  path?: string | null;
  version?: string | null;
  className?: string;
  alt?: string;
  ttlSec?: number;
};

export function FortunePhoto({
  fortuneId,
  bucket,
  path,
  version,
  className,
  alt,
  ttlSec = 300,
}: FortunePhotoProps) {
  const b = useMemo(() => (bucket ?? 'photos') as string, [bucket]);
  const p = useMemo(() => (path ?? undefined) as string | undefined, [path]);
  const v = useMemo(() => (version ?? undefined) as string | undefined, [version]);

  const signedUrl = useSignedUrl(b, p, ttlSec, v, fortuneId);

  // If we don't have a path, we can't render anything.
  if (!p) {
    return null;
  }

  // While loading (or if signing fails), show a lightweight placeholder to avoid layout jumps.
  if (!signedUrl) {
    return <div className={className} aria-busy="true" />;
  }

  return (
    <img
      className={className}
      src={signedUrl}
      alt={alt ?? 'Fortune photo'}
      loading="lazy"
      decoding="async"
    />
  );
}

export default FortunePhoto;