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
          // Upload to Supabase
          const fileName = `${options.fortuneId}-${Date.now()}.${file.name.split('.').pop()}`;
          const filePath = `${options.userId}/${fileName}`;

          console.log('[MOCK UPLOADER] Uploading file:', { fileName, filePath, fileSize: file.size, fileType: file.type });

          // First check if user is authenticated
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('User not authenticated');
          }

          console.log('[MOCK UPLOADER] User authenticated, proceeding with upload');

          const { data, error } = await supabase.storage
            .from('photos')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (error) {
            console.error('[MOCK UPLOADER] Upload error:', error);
            throw error;
          }

          console.log('[MOCK UPLOADER] Upload successful:', data);

          // Double check the file exists by getting public URL
          const { data: fileInfo } = supabase.storage
            .from('photos')
            .getPublicUrl(data.path);

          console.log('[MOCK UPLOADER] File public URL:', fileInfo.publicUrl);

          // Verify the file was actually uploaded
          const { data: fileList, error: listError } = await supabase.storage
            .from('photos')
            .list(options.userId, {
              search: fileName
            });

          if (listError) {
            console.warn('[MOCK UPLOADER] Could not verify upload:', listError);
          } else {
            console.log('[MOCK UPLOADER] File verification:', fileList);
          }

          // Get signed URL
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('photos')
            .createSignedUrl(data.path, 300); // 5 minutes

          if (signedUrlError) {
            console.error('[MOCK UPLOADER] Signed URL error:', signedUrlError);
            throw signedUrlError;
          }

          console.log('[MOCK UPLOADER] Signed URL created successfully');

          // Get image dimensions
          const img = new Image();
          img.src = URL.createObjectURL(file);
          await new Promise((resolve) => { img.onload = resolve; });

          // Don't save fortune_media record here - it will be saved when fortune is created
          // Store the upload metadata for later use

          resolve({
            bucket: 'photos',
            path: data.path,
            mime: file.type,
            width: img.width,
            height: img.height,
            sizeBytes: file.size,
            signedUrl: signedUrlData?.signedUrl || '',
            replaced: false
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