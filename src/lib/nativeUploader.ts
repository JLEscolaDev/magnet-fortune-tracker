import { NativeUploaderOptions, NativeUploaderResult, NativeUploader } from '@/types/native';
import { supabase } from '@/integrations/supabase/client';
import { getAccessToken } from '@/integrations/supabase/auth';

// Development mock for testing in browser/simulator
const createMockUploader = (): NativeUploader => {
  const pickAndUploadFortunePhoto = async (options: NativeUploaderOptions): Promise<NativeUploaderResult> => {
    // Simulate file picker in development
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve({
            bucket: 'photos',
            path: '',
            mime: '',
            width: 0,
            height: 0,
            sizeBytes: 0,
            signedUrl: '',
            replaced: false,
            cancelled: true
          });
          return;
        }

        try {
          // Follow the same contract as native bridges
          console.log('[MOCK UPLOADER] TICKET_REQUEST - fortuneId:', options.fortuneId);

          // Step 1: Call issue-fortune-upload-ticket
          const { callEdge } = await import('./edge-functions');
          const ticketResponse = await callEdge<{
            bucket: string;
            bucketRelativePath: string;
            url: string;
            uploadMethod: string;
            formFieldName: string;
            headers: Record<string, string>;
          }>('issue-fortune-upload-ticket', {
            fortune_id: options.fortuneId,
            mime: file.type || 'image/jpeg'
          });

          if (ticketResponse.error || !ticketResponse.data) {
            throw new Error(ticketResponse.error || 'Failed to get upload ticket');
          }

          const { bucket, bucketRelativePath, url: uploadUrl, formFieldName, headers } = ticketResponse.data;
          
          console.log('[MOCK UPLOADER] TICKET_OK - bucket:', bucket, 'bucketRelativePath:', bucketRelativePath);

          // Step 2: Upload using POST multipart/form-data
          const formData = new FormData();
          formData.append(formFieldName, file);

          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: headers,
            body: formData
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.statusText}`);
          }

          console.log('[MOCK UPLOADER] UPLOAD_OK - bucketRelativePath:', bucketRelativePath);

          // Step 3: Call finalize-fortune-photo
          // Get image dimensions
          const img = new Image();
          img.src = URL.createObjectURL(file);
          await new Promise((resolve) => { img.onload = resolve; });

          const finalizeResponse = await callEdge<{
            signedUrl: string;
            replaced: boolean;
            media?: {
              fortune_id: string;
              bucket: string;
              path: string;
              updated_at: string;
            } | null;
          }>('finalize-fortune-photo', {
            fortune_id: options.fortuneId,
            bucket: bucket,
            path: bucketRelativePath, // Use bucketRelativePath (no prefix)
            width: img.width,
            height: img.height,
            size_bytes: file.size,
            mime: file.type || 'image/jpeg'
          });

          if (finalizeResponse.error || !finalizeResponse.data) {
            throw new Error(finalizeResponse.error || 'Failed to finalize photo');
          }

          console.log('[MOCK UPLOADER] FINALIZE_OK - bucketRelativePath:', bucketRelativePath);

          resolve({
            bucket: bucket,
            path: bucketRelativePath,
            mime: file.type || 'image/jpeg',
            width: img.width,
            height: img.height,
            sizeBytes: file.size,
            signedUrl: finalizeResponse.data.signedUrl,
            replaced: finalizeResponse.data.replaced,
            cancelled: false,
            pending: false,
            media: finalizeResponse.data.media || undefined
          });
        } catch (error) {
          console.error('[MOCK UPLOADER] Upload failed:', error);
          resolve({
            bucket: 'photos',
            path: '',
            mime: '',
            width: 0,
            height: 0,
            sizeBytes: 0,
            signedUrl: '',
            replaced: false,
            cancelled: true
          });
        }
      };
      input.click();
    });
  };

  return { pickAndUploadFortunePhoto };
};

// Initialize native uploader availability
export const initializeNativeUploader = () => {
  // Check if we're in development mode or if native uploader should be mocked
  const isDevelopment = import.meta.env.DEV;
  const mockNativeUploader = localStorage.getItem('mockNativeUploader') === 'true';

  if (isDevelopment || mockNativeUploader) {
    console.log('🔧 Development mode: Enabling mock native uploader');
    window.NativeUploaderAvailable = true;
    window.NativeUploader = createMockUploader();
  } else if (window.NativeUploader) {
    // Real native uploader is available
    console.log('📱 Native uploader detected');
    window.NativeUploaderAvailable = true;
  } else {
    console.log('❌ No native uploader available');
    window.NativeUploaderAvailable = false;
  }
};

// Export utility to enable mock uploader for testing
export const enableMockUploader = () => {
  localStorage.setItem('mockNativeUploader', 'true');
  initializeNativeUploader();
  // Trigger a page refresh to ensure the button appears
  window.location.reload();
};

export const disableMockUploader = () => {
  localStorage.removeItem('mockNativeUploader');
  window.NativeUploaderAvailable = false;
  console.log('❌ Mock native uploader disabled.');
};