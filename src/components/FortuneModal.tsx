import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Sparkle, CurrencyDollar, Crown, Lock, TrendUp, Trophy, Star, Camera, Image, DeviceMobile } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FortuneCategory, CategoryData, Fortune } from '@/types/fortune';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeText, validateNumericValue, validateCategory, formRateLimiter } from '@/lib/security';
import { useFreePlanLimits } from '@/hooks/useFreePlanLimits';
import { useAppState } from '@/contexts/AppStateContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { SUBSCRIPTION_LIMITS } from '@/config/limits';
import { addFortune, updateFortune } from '@/lib/fortunes';
import confetti from 'canvas-confetti';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/auth/AuthProvider';
import { getFortuneMedia, type FortuneMedia } from '@/integrations/supabase/fortuneMedia';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import type { NativeUploaderOptions, NativeUploaderResult, NativePhotoPickerResult } from '@/types/native';
import { useIsNativePlatform } from '@/hooks/useIsNativePlatform';
import { processAndUpload } from '@/lib/nativeUploader';

interface FortuneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFortuneAdded?: () => void;
  onFortuneUpdated?: () => void;
  selectedDate?: Date | null;
  fortune?: Fortune | null; // If provided, we're in edit mode
  mode?: 'create' | 'edit'; // Explicit mode specification
}

const defaultCategories: CategoryData[] = [
  { name: 'Wealth', hasNumericValue: true, color: 'hsl(var(--gold))' },
  { name: 'Health', hasNumericValue: false, color: 'hsl(var(--health))' },
  { name: 'Love', hasNumericValue: false, color: 'hsl(var(--love))' },
  { name: 'Opportunity', hasNumericValue: false, color: 'hsl(var(--opportunity))' },
  { name: 'Tasks', hasNumericValue: false, color: 'hsl(210, 70%, 60%)' },
  { name: 'Other', hasNumericValue: false, color: 'hsl(var(--muted-foreground))' }
];

const shootCoins = () => {
  const colors = ['#D6B94C', '#FFD700', '#F2F0E8'];
  
  // Gold coin animation for wealth
  confetti({
    particleCount: 150,
    spread: 90,
    origin: { y: 0.5 },
    colors,
    shapes: ['circle'],
    gravity: 1.2,
    scalar: 1.5,
    drift: 0.1,
    ticks: 300,
  });
  
  // Additional gold sparkles
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 40,
      origin: { y: 0.4 },
      colors: ['#FFD700', '#D6B94C'],
      shapes: ['circle'],
      gravity: 0.6,
      scalar: 0.8,
    });
  }, 200);
  
  // Vibrate if supported
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 50, 100]);
  }
};

const shootConfetti = () => {
  const colors = ['#046B4A', '#F2F0E8', '#D6B94C'];
  
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.6 },
    colors,
    gravity: 0.8,
    scalar: 1.0,
  });
  
  // Vibrate if supported
  if ('vibrate' in navigator) {
    navigator.vibrate(30);
  }
};

async function convertWebpToJpegIfNeeded(file: File): Promise<File> {
  if (file.type !== 'image/webp') return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode WEBP image'));
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width || 1;
    canvas.height = img.height || 1;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    ctx.drawImage(img, 0, 0);

    const jpegBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to convert WEBP to JPEG'))),
        'image/jpeg',
        0.92
      );
    });

    return new File([jpegBlob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const FortuneModal = ({ 
  isOpen, 
  onClose, 
  onFortuneAdded, 
  onFortuneUpdated, 
  selectedDate, 
  fortune, 
  mode 
}: FortuneModalProps) => {
  // Determine if we're in edit mode
  const isEditMode = mode === 'edit' || !!fortune;
  
  const [text, setText] = useState('');
  const [category, setCategory] = useState<FortuneCategory>('Wealth');
  const [fortuneValue, setFortuneValue] = useState('');
  const [impactLevel, setImpactLevel] = useState<string>('small_step');
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryData[]>(defaultCategories);
  const [bigWinsCount, setBigWinsCount] = useState<number>(0);
  const [photoAttaching, setPhotoAttaching] = useState(false);
  const [fortunePhoto, setFortunePhoto] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreviewUrl, setPendingPhotoPreviewUrl] = useState<string | null>(null);
  const [persistedFortuneId, setPersistedFortuneId] = useState<string | null>(null);
  const [pendingPhotoUpload, setPendingPhotoUpload] = useState<{
    fortuneId: string;
    path: string;
    bucket: string;
  } | null>(null);
  const pollCleanupRef = useRef<(() => void) | null>(null);
  const ticketRequested = useRef(false);
  const userSelectedPhotoRef = useRef(false);
  const { toast } = useToast();
  const { user, accessToken } = useAuth();
  const freePlanStatus = useFreePlanLimits();
  const { activeSubscription, fortunesCountToday, addError } = useAppState();
  const { isHighTier } = useSubscription();
  const isMobile = useIsMobile();
  const isNative = useIsNativePlatform();

  // Debug logging disabled to prevent render loop logs
  // Use React DevTools or breakpoints for debugging instead

  // Define loadBigWinsCount before it's used in useEffect
  // Only called when modal opens in create mode - use force=true since it's user action
  const loadBigWinsCount = useCallback(async () => {
    try {
      if (!user) return;

      const now = new Date();
      const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const endOfYear = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));

      // Use centralized fetcher with force=true (user opened modal)
      const { fetchFortuneList } = await import('@/lib/fortuneListFetcher');
      const data = await fetchFortuneList({
        p_from: startOfYear.toISOString(),
        p_to: endOfYear.toISOString(),
        force: true // User action - opening modal
      });
      
      if (!data) {
        // Fetch was skipped due to guards - return early
        return;
      }

      if (data) {
        const bigWins = data.filter((fortune) => fortune.impact_level === 'big_win');
        setBigWinsCount(bigWins.length);
      }
    } catch (error) {
      console.error('Error loading big wins count:', error);
    }
  }, [user]);

  // Define loadCategories before it's used in useEffect
  const loadCategories = useCallback(async () => {
    try {
      if (!user) return;

      const { data } = await supabase
        .from('custom_categories')
        .select('*')
        .eq('user_id', user.id);

      if (data) {
        const customCatsData = data.map(cat => ({
          name: cat.name,
          hasNumericValue: cat.has_numeric_value,
          color: cat.color
        }));
        setCategories([...defaultCategories, ...customCatsData]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, [user, defaultCategories]);

  // Load custom categories and big wins count on mount
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      if (!isEditMode) {
        loadBigWinsCount();
      }
    }
  }, [isOpen, isEditMode, loadCategories, loadBigWinsCount]);

  // Cleanup polling when component unmounts or modal closes
  useEffect(() => {
    return () => {
      if (pollCleanupRef.current) {
        pollCleanupRef.current();
        pollCleanupRef.current = null;
      }
    };
  }, []);

  // Cleanup local preview object URL
  useEffect(() => {
    return () => {
      if (pendingPhotoPreviewUrl && pendingPhotoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pendingPhotoPreviewUrl);
      }
    };
  }, [pendingPhotoPreviewUrl]);

  // Populate form when editing - wait for categories to load
  useEffect(() => {
    if (isEditMode && fortune && isOpen && categories.length > 0) {
      console.log('[FORTUNE_MODAL] Populating edit form:', { 
        fortuneCategory: fortune.category, 
        availableCategories: categories.map(c => c.name) 
      });
      setText(fortune.text || '');
      setCategory(fortune.category as FortuneCategory || '');
      setFortuneValue(fortune.fortune_value ? String(fortune.fortune_value) : '');
      setImpactLevel(fortune.impact_level || 'small_step');
      // Prevent async photo load from overwriting local preview
      userSelectedPhotoRef.current = false;
      // Load existing photo if available
      loadFortunePhoto(fortune.id);
      // Clear any local (unsaved) photo selection when opening edit mode
      setPendingPhotoFile(null);
      setPendingPhotoPreviewUrl(null);
    } else if (!isEditMode && isOpen) {
      // Reset form for create mode
      setText('');
      setCategory('Wealth'); // Default to Wealth category
      setFortuneValue('');
      setImpactLevel('small_step');
      setPersistedFortuneId(null);
      setFortunePhoto(null);
      setPendingPhotoFile(null);
      setPendingPhotoPreviewUrl(null);
    }
  }, [isEditMode, fortune, isOpen, categories]);

  const getCurrentCategory = () => {
    return categories.find(cat => cat.name === category) || defaultCategories[0];
  };

  const loadFortunePhoto = async (fortuneId: string) => {
    try {
      // If the user has selected a new photo in this session, do NOT overwrite the preview
      if (userSelectedPhotoRef.current || pendingPhotoPreviewUrl || pendingPhotoFile) {
        return;
      }

      // IMPORTANT: Always sign via Edge (SIGN_ONLY) to avoid Storage 400/Object not found issues.
      const { data, error } = await supabase.functions.invoke('finalize-fortune-photo', {
        body: {
          action: 'SIGN_ONLY',
          fortune_id: fortuneId,
          ttlSec: 300,
        },
      });

      if (error) {
        console.error('[FORTUNE_MODAL] Error signing fortune photo via edge:', error);
        setFortunePhoto(null);
        return;
      }

      // If a selection happened while we were awaiting, do not overwrite
      if (userSelectedPhotoRef.current || pendingPhotoPreviewUrl || pendingPhotoFile) {
        return;
      }

      const signedUrl = (data as { signedUrl?: string | null } | null)?.signedUrl ?? null;
      setFortunePhoto(signedUrl);
    } catch (error) {
      console.error('Error loading fortune photo:', error);
      setFortunePhoto(null);
    }
  };

  // After a successful photo upload/finalize, trigger UI refresh everywhere the photo is rendered.
  // This is robust even when the native uploader doesn't return `media` metadata.
  const dispatchPhotoRefreshEvents = useCallback(async (fortuneId: string, signedUrl?: string | null) => {
    try {
      // Fetch latest media to obtain updated_at (used as version for cache busting)
      const mediaData = await getFortuneMedia(fortuneId);
      const updatedAt = mediaData?.updatedAt;

      // If we weren't given a signed URL, try to sign now (always via Edge)
      let finalSignedUrl: string | null | undefined = signedUrl ?? undefined;
      if (!finalSignedUrl && mediaData) {
        const { data, error } = await supabase.functions.invoke('finalize-fortune-photo', {
          body: {
            action: 'SIGN_ONLY',
            fortune_id: fortuneId,
            ttlSec: 300,
          },
        });

        if (!error) {
          finalSignedUrl = (data as { signedUrl?: string | null } | null)?.signedUrl ?? null;
        }
      }

      if (updatedAt) {
        window.dispatchEvent(new CustomEvent('fortunePhotoUpdated', {
          detail: {
            fortuneId,
            updatedAt,
            signedUrl: finalSignedUrl || undefined,
          },
        }));
      }

      // Backward compatible refresh signal
      window.dispatchEvent(new Event('fortunesUpdated'));
      onFortuneUpdated?.();
    } catch (err) {
      console.error('[FORTUNE_MODAL] dispatchPhotoRefreshEvents failed:', err);
      window.dispatchEvent(new Event('fortunesUpdated'));
      onFortuneUpdated?.();
    }
  }, [onFortuneUpdated]);

  // Await a signed URL for a fortune photo via Edge (SIGN_ONLY). Used to block the Save flow
  // so the modal only closes once the upload is truly available.
  const waitForSignedPhotoUrl = useCallback(async (fortuneId: string, maxAttempts: number = 6, delayMs: number = 750) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await supabase.functions.invoke('finalize-fortune-photo', {
        body: {
          action: 'SIGN_ONLY',
          fortune_id: fortuneId,
          ttlSec: 300,
        },
      });

      if (!error) {
        const signedUrl = (data as { signedUrl?: string | null } | null)?.signedUrl ?? null;
        if (signedUrl) {
          return signedUrl;
        }
      }

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    return null;
  }, []);

  const pollForPhotoCompletion = useCallback((path: string, bucket: string, maxAttempts: number = 3): (() => void) => {
    const targetFortuneId = fortune?.id || '';
    let attempts = 0;
    let isCancelled = false;
    const pollInterval = setInterval(async () => {
      // Check if component unmounted or polling was cancelled
      if (isCancelled) {
        clearInterval(pollInterval);
        return;
      }

      attempts++;
      console.log(`[PHOTO-POLL] Polling attempt ${attempts}/${maxAttempts} for path: ${path}`);
      
      try {
        // IMPORTANT: Always sign via Edge (SIGN_ONLY). We do not sign directly via Storage from the browser.
        const { data, error } = await supabase.functions.invoke('finalize-fortune-photo', {
          body: {
            action: 'SIGN_ONLY',
            fortune_id: targetFortuneId,
            ttlSec: 300,
          },
        });

        if (error) {
          throw error;
        }

        const signedUrl = (data as { signedUrl?: string | null } | null)?.signedUrl ?? null;

        if (signedUrl) {
          console.log('[PHOTO-POLL] Signed URL available:', signedUrl);
          if (!isCancelled) {
            setFortunePhoto(signedUrl);
          }
          clearInterval(pollInterval);
          
          // After polling completes, fetch media record to confirm DB update and trigger refresh
          if (targetFortuneId && !isCancelled) {
            try {
              const mediaData = await getFortuneMedia(targetFortuneId);
              if (mediaData) {
                console.log('[PHOTO-POLL] DB_UPDATE_CONFIRMED - Triggering refresh', {
                  fortuneId: mediaData.fortuneId,
                  bucket: mediaData.bucket,
                  path: mediaData.path,
                  updatedAt: mediaData.updatedAt
                });
                
                // Get signed URL for immediate use (always via Edge)
                const { data, error } = await supabase.functions.invoke('finalize-fortune-photo', {
                  body: {
                    action: 'SIGN_ONLY',
                    fortune_id: mediaData.fortuneId,
                    ttlSec: 300,
                  },
                });

                const signedUrl = error
                  ? null
                  : (data as { signedUrl?: string | null } | null)?.signedUrl ?? null;
                
                // Dispatch specific photo update event with media info
                const photoUpdateEvent = new CustomEvent("fortunePhotoUpdated", {
                  detail: {
                    fortuneId: mediaData.fortuneId,
                    updatedAt: mediaData.updatedAt,
                    signedUrl: signedUrl || undefined
                  }
                });
                console.log('[PHOTO-POLL] Dispatching fortunePhotoUpdated event after polling', {
                  fortuneId: mediaData.fortuneId,
                  updatedAt: mediaData.updatedAt
                });
                window.dispatchEvent(photoUpdateEvent);
                
                // Also dispatch general event for backward compatibility
                console.log('[PHOTO-POLL] Dispatching fortunesUpdated event after polling');
                window.dispatchEvent(new Event("fortunesUpdated"));
                onFortuneUpdated?.();
              } else {
                console.warn('[PHOTO-POLL] Media record not found after polling - refresh may not work correctly');
              }
            } catch (err) {
              console.error('[PHOTO-POLL] Error fetching media after polling:', err);
              // Still dispatch event even if fetch fails, to trigger refresh
              if (!isCancelled) {
                console.log('[PHOTO-POLL] Dispatching fortunesUpdated event (fallback)');
                window.dispatchEvent(new Event("fortunesUpdated"));
                onFortuneUpdated?.();
              }
            }
          }
          return;
        }
      } catch (error) {
        console.error('[PHOTO-POLL] Error polling for photo:', error);
      }
      
      if (attempts >= maxAttempts) {
        console.log('[PHOTO-POLL] Max polling attempts reached');
        clearInterval(pollInterval);
        if (!isCancelled) {
          setFortunePhoto(null);
          toast({
            title: "Photo processing failed",
            description: "The photo upload took too long to process. Please try again.",
            variant: "destructive",
          });
        }
      }
    }, 2000); // Poll every 2 seconds

    // Return cleanup function synchronously
    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
    };
  }, [fortune?.id, onFortuneUpdated, onClose, toast]);

  const handleAttachPhoto = async () => {
    // Prevent multiple simultaneous requests
    if (ticketRequested.current) {
      console.log('[PHOTO] Picker already in progress, ignoring duplicate request');
      return;
    }

    // Lock immediately to avoid double taps / repeated UI events
    ticketRequested.current = true;

    console.log('[PHOTO] Starting photo pick (preview-only, upload on Save)...');

    // Block on web - only allow on native
    if (!isNative) {
      toast({
        title: "Mobile app required",
        description: "Photo attachments can only be added from the mobile app.",
        variant: "destructive",
      });
      ticketRequested.current = false;
      return;
    }

    // Must be Pro/Lifetime
    if (!isHighTier) {
      toast({
        title: "Pro subscription required",
        description: "Photo attachments require a Pro or Lifetime subscription.",
        variant: "destructive",
      });
      ticketRequested.current = false;
      return;
    }

    // Only allow attaching photos in edit mode (existing fortune)
    if (!isEditMode || !fortune?.id) {
      toast({
        title: "Save first",
        description: "Save this fortune first, then edit it to add a photo.",
        variant: "destructive",
      });
      ticketRequested.current = false;
      return;
    }

    // Prefer the new picker (preview-only flow). Legacy uploader cannot defer upload.
    // NOTE: Do NOT rely only on the "Available" flags; some builds may not inject them.
    const hasNewPicker = typeof window.NativePhotoPicker?.pickPhoto === 'function';
    const hasLegacyUploader = typeof window.NativeUploader?.upload === 'function';

    // Fallback: some iOS builds may not inject window.NativePhotoPicker yet, but Capacitor Camera exists.
    const hasCapacitorCamera = typeof (window as any).Capacitor !== 'undefined'
      && !!(window as any).Capacitor?.Plugins?.Camera
      && typeof (window as any).Capacitor.Plugins.Camera.getPhoto === 'function';

    const pickPhotoFallback = async (): Promise<NativePhotoPickerResult> => {
      const Cap = (window as any).Capacitor;
      const Camera = Cap?.Plugins?.Camera;
      if (!Camera?.getPhoto) {
        throw new Error('Camera plugin not available');
      }

      const cameraResult = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        source: 'PHOTOS',
        resultType: 'Base64',
        correctOrientation: true,
      });

      if (!cameraResult) {
        return { cancelled: true } as NativePhotoPickerResult;
      }

      const base64 = (cameraResult as any).base64String as string | undefined;
      const format = ((cameraResult as any).format as string | undefined)?.toLowerCase();

      const inferMime = (): string => {
        if (format === 'png') return 'image/png';
        if (format === 'webp') return 'image/webp';
        return 'image/jpeg';
      };

      if (base64 && base64.length > 0) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const mimeType = inferMime();

        // Try to resolve dimensions from plugin if present
        let width = cameraResult.width || 0;
        let height = cameraResult.height || 0;

        return {
          cancelled: false,
          bytes,
          mimeType,
          width,
          height,
        } as NativePhotoPickerResult;
      }

      // Fallback (older behavior): use webPath/path and fetch
      const webPath = cameraResult.webPath || cameraResult.path || '';
      if (!webPath) {
        return { cancelled: true } as NativePhotoPickerResult;
      }

      const fileResp = await fetch(webPath);
      const blob = await fileResp.blob();
      const mimeType = (blob.type || inferMime() || 'image/jpeg') as string;
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);

      // Try to resolve dimensions
      let width = cameraResult.width || 0;
      let height = cameraResult.height || 0;
      if (!width || !height) {
        await new Promise<void>((resolve) => {
          const img = new (window as any).Image();
          img.onload = () => {
            width = img.width || 0;
            height = img.height || 0;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = webPath;
          setTimeout(() => resolve(), 3000);
        });
      }

      return {
        cancelled: false,
        bytes,
        mimeType,
        width,
        height,
      } as NativePhotoPickerResult;
    };

    // If we have neither the new picker nor a Capacitor Camera fallback, we can't proceed.
    if (!hasNewPicker && !hasCapacitorCamera && !hasLegacyUploader) {
      toast({
        title: "Photo upload unavailable",
        description: "Please update the app to the latest version.",
        variant: "destructive",
      });
      ticketRequested.current = false;
      return;
    }

    // If only legacy uploader exists (no new picker and no Capacitor fallback), we cannot support "upload on Save" reliably.
    if (!hasNewPicker && !hasCapacitorCamera && hasLegacyUploader) {
      toast({
        title: "Update required",
        description: "Please update the app. Your current version uploads immediately and can't wait for Save.",
        variant: "destructive",
      });
      ticketRequested.current = false;
      return;
    }

    setPhotoAttaching(true);

    try {
      if (!accessToken || !user) {
        throw new Error('Authentication required');
      }

      console.log('[PHOTO] Using NativePhotoPicker for preview-only selection');

      const pickerResult: NativePhotoPickerResult = hasNewPicker
        ? await window.NativePhotoPicker!.pickPhoto()
        : await pickPhotoFallback();

      const anyResult = pickerResult as any;

      // Some native bridges return bytes, others return Capacitor Camera-style base64String,
      // and others return webPath/path. Accept any of them.
      const rawBytes: Uint8Array | undefined = anyResult?.bytes;
      const hasBytes = !!rawBytes && rawBytes.length > 0;

      const base64String: string | undefined = typeof anyResult?.base64String === 'string' && anyResult.base64String.length
        ? anyResult.base64String
        : (typeof anyResult?.base64 === 'string' && anyResult.base64.length ? anyResult.base64 : undefined);
      const hasBase64 = !!base64String;

      const webPath: string | undefined = (typeof anyResult?.webPath === 'string' && anyResult.webPath.length)
        ? anyResult.webPath
        : (typeof anyResult?.path === 'string' && anyResult.path.length)
          ? anyResult.path
          : undefined;

      const hasWebPath = !!webPath;

      // Treat as cancellation ONLY if we have no usable payload AND the bridge explicitly says cancelled.
      // Some iOS/Capacitor builds return `saved:false` even when a photo was chosen (it only means "not saved to gallery").
      const cancelledFlag = anyResult?.cancelled === true;
      const savedFlag = typeof anyResult?.saved === 'boolean' ? anyResult.saved : undefined;

      // `saved:false` from Capacitor Camera does NOT mean user cancelled; it means "not saved to gallery".
      const hasUsablePayload = hasBytes || hasBase64 || hasWebPath;

      if (cancelledFlag && !hasUsablePayload) {
        console.log('[PHOTO] User cancelled photo selection');
        return;
      }

      // If we got here with no payload, the native bridge is not returning bytes/webPath.
      // This is NOT a user cancel; it's a bridge bug/misconfiguration.
      if (!hasUsablePayload) {
        console.error('[PHOTO] Native picker returned no image payload', {
          cancelledFlag,
          savedFlag,
          keys: Object.keys(anyResult || {}),
          sample: anyResult,
        });
        toast({
          title: 'Photo selection failed',
          description: 'Native picker returned no image data (bytes/webPath missing). Please update the native bridge.',
          variant: 'destructive',
        });
        return;
      }

      if ((cancelledFlag || savedFlag === false) && hasUsablePayload) {
        console.warn('[PHOTO] Native picker reported cancelled/saved=false but returned data. Continuing.', {
          cancelledFlag,
          savedFlag,
          usedBytes: hasBytes,
          usedWebPath: hasWebPath,
        });
      }

      // Build a File for preview + later upload.
      // Priority: bytes -> base64 -> webPath fetch fallback.
      let mimeType: string = (anyResult?.mimeType || anyResult?.format || '').toString();
      if (!mimeType) {
        // Capacitor Camera sometimes returns `format` like "jpeg"/"png"
        const fmt = (anyResult?.format || '').toString().toLowerCase();
        if (fmt === 'png') mimeType = 'image/png';
        else if (fmt === 'webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      }

      let file: File;

      if (hasBytes) {
        const inferredExt = mimeType === 'image/png'
          ? 'png'
          : mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';

        const bytesCopy = new Uint8Array(rawBytes);
        const blob = new Blob([bytesCopy.buffer as ArrayBuffer], { type: mimeType });
        const rawFile = new File(
          [blob],
          `photo-${Date.now()}.${inferredExt}`,
          { type: mimeType }
        );

        // iOS WebViews can fail to render WEBP; convert to JPEG for preview + upload
        file = await convertWebpToJpegIfNeeded(rawFile);
      } else if (hasBase64) {
        const binary = atob(base64String!);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const inferredExt = mimeType === 'image/png'
          ? 'png'
          : mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';

        const blob = new Blob([bytes], { type: mimeType || 'image/jpeg' });
        const rawFile = new File(
          [blob],
          `photo-${Date.now()}.${inferredExt}`,
          { type: mimeType || 'image/jpeg' }
        );

        file = await convertWebpToJpegIfNeeded(rawFile);
        mimeType = file.type;
      } else if (hasWebPath) {
        // Fetch the file from the webPath/path and create a File
        const resp = await fetch(webPath!);
        const blob = await resp.blob();
        const fetchedMime = (blob.type || mimeType || 'image/jpeg');

        const inferredExt = fetchedMime === 'image/png'
          ? 'png'
          : fetchedMime === 'image/webp'
            ? 'webp'
            : 'jpg';

        const rawFile = new File(
          [blob],
          `photo-${Date.now()}.${inferredExt}`,
          { type: fetchedMime }
        );

        file = await convertWebpToJpegIfNeeded(rawFile);
        mimeType = file.type;
      } else {
        throw new Error('No image data returned from native picker');
      }

      // Replace previous preview URL if any
      if (pendingPhotoPreviewUrl && pendingPhotoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pendingPhotoPreviewUrl);
      }

      const previewUrl = URL.createObjectURL(file);
      userSelectedPhotoRef.current = true;

      // Store for upload on Save
      setPendingPhotoFile(file);
      setPendingPhotoPreviewUrl(previewUrl);

      // Show preview immediately in the modal
      setFortunePhoto(previewUrl);

      toast({
        title: 'Photo selected',
        description: 'Preview updated. Tap Update Fortune to upload and save.',
      });

      console.log('[PHOTO] Photo selected for later upload', {
        fortuneId: fortune.id,
        mimeType: file.type,
        size: file.size,
        usedBytes: hasBytes,
        usedWebPath: hasWebPath,
      });
    } catch (error) {
      console.error('[PHOTO] Error picking photo:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to pick photo. Please try again.";
      toast({
        title: "Photo selection failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setPhotoAttaching(false);
      ticketRequested.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limiting check
    const rateLimitKey = isEditMode ? 'edit-fortune' : 'add-fortune';
    if (!formRateLimiter.canProceed(rateLimitKey)) {
      toast({
        title: "Too many requests",
        description: "Please wait a moment before submitting again",
        variant: "destructive",
      });
      return;
    }

    // For create mode, check free plan limits
    if (!isEditMode) {
      const hasActiveSubscription = activeSubscription !== null;
      if (!hasActiveSubscription && !freePlanStatus.canAddFortune) {
        const dailyLimit = fortunesCountToday >= SUBSCRIPTION_LIMITS.FREE_RESTRICTED_DAILY_LIMIT;
        if (dailyLimit) {
          toast({
            title: "Daily limit reached",
            description: "Your free plan now limits you to 1 fortune per day. Upgrade to Pro for unlimited access!",
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    try {
      // Input validation and sanitization
      if (!text.trim() || !category) {
        toast({
          title: "Error",
          description: !text.trim() ? "Please enter your fortune" : "Please select a category",
          variant: "destructive",
        });
        
        // Error feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
        
        return;
      }

      // Sanitize and validate inputs
      let sanitizedText: string;
      let validatedCategory: string;
      let validatedValue: number | null = null;

      try {
        sanitizedText = sanitizeText(text, 500);
        validatedCategory = validateCategory(category);
      } catch (validationError) {
        const errorMessage = validationError instanceof Error ? validationError.message : 'Validation failed';
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      if (getCurrentCategory().hasNumericValue && fortuneValue) {
        validatedValue = validateNumericValue(fortuneValue, 0, 1000000);
      }

      setIsLoading(true);
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to track fortunes",
          variant: "destructive",
        });
        return;
      }

      if (isEditMode && fortune) {
        // If the user selected a new photo in this edit session, upload it now (only on native)
        // IMPORTANT: Do not close the modal until the uploaded file is actually available.
        if (isNative && isHighTier && pendingPhotoFile) {
          if (!accessToken || !user) {
            throw new Error('Authentication required');
          }

          const uploadOptions: NativeUploaderOptions = {
            supabaseUrl: 'https://pegiensgnptpdnfopnoj.supabase.co',
            accessToken,
            userId: user.id,
            fortuneId: fortune.id,
          };

          setFortunePhoto('pending');

          const uploadResult = await new Promise<NativeUploaderResult>((resolve) => {
            processAndUpload(uploadOptions, pendingPhotoFile, resolve);
          });

          if (uploadResult.cancelled) {
            throw new Error('Photo upload cancelled');
          }

          // If uploader couldn't return a signed URL immediately, wait until Edge can sign it.
          let finalSignedUrl: string | null = null;

          if (uploadResult.signedUrl && uploadResult.signedUrl !== 'pending') {
            finalSignedUrl = uploadResult.signedUrl;
          } else {
            finalSignedUrl = await waitForSignedPhotoUrl(fortune.id, 8, 750);
          }

          if (!finalSignedUrl) {
            throw new Error('Photo upload failed to finalize. Please try again.');
          }

          setFortunePhoto(finalSignedUrl);
          userSelectedPhotoRef.current = false;
          await dispatchPhotoRefreshEvents(fortune.id, finalSignedUrl);

          // Clear local pending selection after successful upload
          if (pendingPhotoPreviewUrl && pendingPhotoPreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(pendingPhotoPreviewUrl);
          }
          setPendingPhotoFile(null);
          setPendingPhotoPreviewUrl(null);
          setPendingPhotoUpload(null);
        }
        // Update existing fortune
        const updateData: { text: string; category: string; fortune_value?: number | null; impact_level?: string } = {
          text: sanitizedText,
          category: validatedCategory,
        };

        // Only include fortune_value if the category supports numeric values
        if (getCurrentCategory().hasNumericValue) {
          updateData.fortune_value = validatedValue;
        } else {
          updateData.fortune_value = null;
        }

        // Include impact_level if it exists
        if (impactLevel) {
          updateData.impact_level = impactLevel;
        }

        await updateFortune(fortune.id, updateData);

        toast({
          title: "Fortune Updated! ✨",
          description: "Your fortune has been successfully updated",
        });

        // Dispatch event to trigger refresh of FortunePhoto components
        window.dispatchEvent(new Event("fortunesUpdated"));
        onFortuneUpdated?.();
      } else {
        // Create new fortune 
        const result = await addFortune(sanitizedText, validatedCategory, validatedValue || 0, selectedDate, impactLevel);

        // Celebration for first action of day
        if (result.streakInfo?.firstOfDay) {
          // Emit analytics
          if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'first_action_of_day', {
              source: 'fortune'
            });
            window.gtag('event', 'streak_celebrate', {
              currentStreak: result.streakInfo.currentStreak
            });
          }

          // Confetti celebration
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FFA500', '#FF6347'],
          });

          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(15);
          }

          // Toast with streak info
          toast({
            title: `Day ${result.streakInfo.currentStreak} streak! 🎉`,
            description: "Great work tracking your fortune!",
            duration: 4000,
          });
        } else {
          // Success animations and feedback - conditional based on category
          if (category === 'Wealth') {
            shootCoins();
          } else {
            shootConfetti();
          }
          
          toast({
            title: "Fortune Tracked! ✨",
            description: "Your fortune has been added to the universe",
          });
        }

        // Refresh big wins count if a big win was added
        if (impactLevel === 'big_win') {
          loadBigWinsCount();
        }

        // Dispatch event to trigger refresh of FortunePhoto components
        window.dispatchEvent(new Event("fortunesUpdated"));
        onFortuneAdded?.();
      }

      // Reset form
      setText('');
      setCategory('');
      setFortuneValue('');
      setImpactLevel('small_step');
      setPersistedFortuneId(null);
      setFortunePhoto(null);
      setPendingPhotoUpload(null);
      setPendingPhotoFile(null);
      setPendingPhotoPreviewUrl(null);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} fortune:`, error);
      if (!isEditMode) {
        addError('fortune-submission', errorMessage);
      }
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'track'} fortune. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const restrictionMessage = freePlanStatus.restrictionMessage;

  // Always show the local preview if present
  const displayPhotoUrl = pendingPhotoPreviewUrl || (fortunePhoto && fortunePhoto !== 'pending' ? fortunePhoto : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm luxury-card p-6 transform transition-transform duration-200 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-semibold flex items-center gap-2">
            <Sparkle size={24} className="text-gold" />
            {isEditMode 
              ? 'Edit Fortune' 
              : selectedDate 
                ? `Track Fortune for ${selectedDate.toLocaleDateString()}` 
                : 'Track Fortune'
            }
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Free Plan Status Banner - Only show in create mode when actually blocked */}
        {!isEditMode && !freePlanStatus.loading && freePlanStatus.isRestricted && !freePlanStatus.canAddFortune && !activeSubscription && (
          <div className="bg-gradient-to-r from-warning/10 to-accent/10 border border-warning/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="bg-gradient-to-r from-warning to-accent p-1.5 rounded-full flex-shrink-0">
                <Lock size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground mb-1">Limited Access</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {restrictionMessage}
                </p>
                <Button 
                  size="sm"
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground"
                >
                  <Crown size={16} className="mr-2" />
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              What fortune came your way today?
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe your fortune, opportunity, or positive moment..."
              className="min-h-24 focus:border-gold focus:ring-gold/20"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {text.length}/500 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Category
            </label>
            <Select value={category} onValueChange={(value) => setCategory(value as FortuneCategory)}>
              <SelectTrigger className="focus:border-gold focus:ring-gold/20">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border shadow-lg z-[60]" sideOffset={4}>
                {categories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      {cat.name === 'Wealth' && <CurrencyDollar size={14} className="text-gold" />}
                      <span>{cat.name}</span>
                      {cat.hasNumericValue && (
                        <span className="text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                          $
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!category && (
              <p className="text-xs text-destructive mt-1">
                Please select a category to continue
              </p>
            )}
          </div>

          {/* Photo Section - Different behavior for native vs web */}
          {isEditMode && (
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Camera size={16} className="text-primary" />
                Photo
              </label>
              {/* Always show the local preview if present */}
              {/*
                displayPhotoUrl: pendingPhotoPreviewUrl || (fortunePhoto && fortunePhoto !== 'pending' ? fortunePhoto : null)
              */}
              {/* Display existing photo (both native and web) */}
              {displayPhotoUrl && (
                <div className="relative">
                  <img 
                    src={displayPhotoUrl} 
                    alt="Fortune attachment" 
                    className="w-full h-48 object-cover rounded border border-border/50"
                  />
                  {/* Only show delete/change buttons on native */}
                  {isNative && isHighTier && (
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-background/70 backdrop-blur"
                        onClick={handleAttachPhoto}
                        disabled={photoAttaching}
                      >
                        Change
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          userSelectedPhotoRef.current = false;
                          if (pendingPhotoPreviewUrl && pendingPhotoPreviewUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(pendingPhotoPreviewUrl);
                          }
                          setPendingPhotoFile(null);
                          setPendingPhotoPreviewUrl(null);
                          setFortunePhoto(null);
                        }}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {/* Show pending state while photo is processing */}
              {fortunePhoto === 'pending' && (
                <div className="relative w-full h-48 bg-muted/50 rounded border border-border/50 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                    <span className="text-sm">Processing photo...</span>
                  </div>
                </div>
              )}
              {/* Native: Show upload button if no photo (or pending) and user has access */}
              {isNative && isHighTier && !displayPhotoUrl && !photoAttaching && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-32 border-dashed border-2 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2"
                  onClick={handleAttachPhoto}
                  disabled={photoAttaching}
                >
                  <Camera size={24} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Attach Photo
                  </span>
                </Button>
              )}
              {/* Show uploading state */}
              {isNative && isHighTier && photoAttaching && (
                <div className="w-full h-32 border-dashed border-2 border-primary/50 rounded flex flex-col items-center justify-center gap-2 bg-muted/30">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </div>
              )}
              {/* Native: Show upgrade prompt for non-high tier users */}
              {isNative && !isHighTier && !displayPhotoUrl && (
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Camera size={16} className="text-warning" />
                    <span className="text-sm text-muted-foreground">
                      Add photos to remember these moments with Pro or Lifetime plans.
                    </span>
                  </div>
                </div>
              )}
              {/* Web: Show informative callout when no photo exists */}
              {!isNative && !displayPhotoUrl && (
                <div className="bg-muted/30 border border-muted/50 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <DeviceMobile size={18} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {isHighTier 
                        ? "You can add photo attachments from the mobile app."
                        : "Photo attachments require Pro (or Trial) and can only be added from the mobile app."
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Note for new fortunes about photo upload - only on native */}
          {isNative && isHighTier && !isEditMode && (
            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-muted/50">
              💡 <strong>Tip:</strong> Save this fortune first, then edit it to add photos. Photo uploads are only available for existing fortunes.
            </div>
          )}

          {/* Web: Callout for new fortunes explaining mobile-only uploads */}
          {!isNative && !isEditMode && (
            <div className="bg-muted/30 border border-muted/50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <DeviceMobile size={18} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {isHighTier 
                    ? "You can add photo attachments from the mobile app after saving this fortune."
                    : "Photo attachments require Pro (or Trial) and can only be added from the mobile app."
                  }
                </span>
              </div>
            </div>
          )}


          {/* Impact Level - Only show in create mode or if editing a fortune with impact_level */}
          {(!isEditMode || (isEditMode && fortune?.impact_level)) && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Impact Level
              </label>
              <div className="space-y-3">
                {/* Impact Level Selector */}
                <div className="flex gap-2">
                  {[
                    { value: 'small_step', label: 'Small Step', icon: TrendUp, size: 16, barWidth: 'w-1/4' },
                    { value: 'milestone', label: 'Milestone', icon: Star, size: 20, barWidth: 'w-1/2' },
                    { value: 'big_win', label: 'Big Win', icon: Trophy, size: 24, barWidth: 'w-full' }
                  ].map((level) => {
                    const Icon = level.icon;
                    const isSelected = impactLevel === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setImpactLevel(level.value)}
                        className={`flex-1 relative overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                          isSelected 
                            ? 'border-primary bg-primary/10 scale-105' 
                            : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <div className="p-3 flex flex-col items-center gap-2">
                          <Icon 
                            size={level.size} 
                            className={`transition-all duration-300 ${
                              isSelected ? 'text-primary animate-pulse' : 'text-muted-foreground'
                            }`} 
                          />
                          <span className={`text-xs font-medium transition-colors duration-300 ${
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                          }`}>
                            {level.label}
                          </span>
                        </div>
                        
                        {/* Animated progress bar */}
                        <div className="absolute bottom-0 left-0 w-full bg-muted/20 h-2">
                          <div 
                            className={`h-full bg-gradient-to-r from-muted-foreground/40 to-muted-foreground/60 transition-all duration-500 ${
                              isSelected ? `${level.barWidth} opacity-100` : 'w-0 opacity-30'
                            }`}
                          />
                        </div>
                        
                        {/* Subtle glow effect for selected item */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Visual impact indicator */}
                <div className="flex items-center justify-center gap-1">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`rounded-full transition-all duration-300 ${
                        (impactLevel === 'small_step' && step === 1) ||
                        (impactLevel === 'milestone' && step <= 2) ||
                        (impactLevel === 'big_win' && step <= 3)
                          ? 'bg-gradient-to-r from-primary to-accent w-3 h-3 animate-scale-in'
                          : 'bg-muted w-2 h-2'
                      }`}
                    />
                  ))}
                </div>
                
                {/* Big Win Yearly Limit - Only show in create mode */}
                {!isEditMode && impactLevel === 'big_win' && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      You can only have 5 big wins per year to keep it real • <span className="text-primary font-medium">{bigWinsCount}/5 used this year</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Numeric Value Input - Show only if category has numeric value */}
          {getCurrentCategory().hasNumericValue && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Value (Optional)
              </label>
              <div className="relative">
                <CurrencyDollar size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gold" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fortuneValue}
                  onChange={(e) => setFortuneValue(e.target.value)}
                  placeholder="0.00"
                  className="pl-10 focus:border-gold focus:ring-gold/20"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Track the monetary value associated with this fortune
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || !text.trim() || !category || (!isEditMode && !activeSubscription && !freePlanStatus.canAddFortune)}
            className={isEditMode ? "w-full" : "luxury-button w-full"}
          >
            {!isEditMode && !activeSubscription && !freePlanStatus.canAddFortune ? (
              <div className="flex items-center gap-2">
                <Lock size={18} />
                Daily Limit Reached
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isEditMode ? 'Updating...' : 'Tracking...'}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Plus size={18} />
                {isEditMode ? 'Update Fortune' : 'Track Fortune'}
              </div>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};