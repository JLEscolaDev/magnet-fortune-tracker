import React, { useState, useEffect } from 'react';
import { getFortuneMedia, getCachedSignedUrl } from '@/integrations/supabase/fortuneMedia';

interface FortunePhotoProps {
  fortuneId: string;
  className?: string;
}

export const FortunePhoto: React.FC<FortunePhotoProps> = ({ fortuneId, className = "" }) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadPhoto = async () => {
      try {
      const media = await getFortuneMedia(fortuneId);
        if (media?.path) {
          const signedUrl = await getCachedSignedUrl(media.path, 'fortune-photos');
          setPhotoUrl(signedUrl);
        }
      } catch (err) {
        console.error('Error loading fortune photo:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadPhoto();
  }, [fortuneId]);

  if (loading) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ aspectRatio: '16/9' }} />
    );
  }

  if (error || !photoUrl) {
    return null; // Don't render anything if no photo or error
  }

  return (
    <img 
      src={photoUrl} 
      alt="Fortune attachment" 
      className={`object-cover rounded border border-border/50 ${className}`}
      style={{ aspectRatio: '16/9' }}
      onError={() => {
        setError(true);
        setPhotoUrl(null);
      }}
    />
  );
};