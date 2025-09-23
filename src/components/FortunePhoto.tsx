import React, { useState, useEffect } from 'react';
import { getFortuneMedia } from '@/integrations/supabase/fortuneMedia';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface FortunePhotoProps {
  fortuneId: string;
  className?: string;
}

export const FortunePhoto: React.FC<FortunePhotoProps> = ({ fortuneId, className = "" }) => {
  const [media, setMedia] = useState<{ bucket: string; path: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const signedUrl = useSignedUrl(media?.bucket, media?.path, 300);

  useEffect(() => {
    const loadMedia = async () => {
      try {
        const mediaData = await getFortuneMedia(fortuneId);
        if (mediaData?.path && mediaData?.bucket) {
          setMedia({ bucket: mediaData.bucket, path: mediaData.path });
        } else {
          setMedia(null);
        }
      } catch (err) {
        console.error('Error loading fortune media:', err);
        setError(true);
        setMedia(null);
      } finally {
        setLoading(false);
      }
    };

    loadMedia();
  }, [fortuneId]);

  if (loading || (!signedUrl && media)) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ aspectRatio: '16/9' }} />
    );
  }

  if (error || !signedUrl || !media) {
    return null; // Don't render anything if no photo or error
  }

  return (
    <img 
      src={signedUrl} 
      alt="Fortune attachment" 
      className={`object-cover rounded border border-border/50 ${className}`}
      style={{ aspectRatio: '16/9' }}
      onError={() => {
        setError(true);
      }}
    />
  );
};