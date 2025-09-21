import { NativeUploaderOptions, NativeUploaderResult } from '@/types/native';
import { supabase } from '@/integrations/supabase/client';
import { getAccessToken } from '@/integrations/supabase/auth';

// Development mock for testing in browser/simulator
const createMockUploader = () => {
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
          const fileName = `${options.fortuneId}_${Date.now()}.${file.name.split('.').pop()}`;
          const filePath = `${options.userId}/${fileName}`;

          const { data, error } = await supabase.storage
            .from('photos')
            .upload(filePath, file);

          if (error) throw error;

          // Get signed URL
          const { data: signedUrlData } = await supabase.storage
            .from('photos')
            .createSignedUrl(data.path, 300); // 5 minutes

          // Get image dimensions
          const img = new Image();
          img.src = URL.createObjectURL(file);
          await new Promise((resolve) => { img.onload = resolve; });

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
          console.error('Mock upload error:', error);
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
    (window as any).NativeUploaderAvailable = true;
    (window as any).NativeUploader = createMockUploader();
  } else if ((window as any).NativeUploader) {
    // Real native uploader is available
    console.log('📱 Native uploader detected');
    (window as any).NativeUploaderAvailable = true;
  } else {
    console.log('❌ No native uploader available');
    (window as any).NativeUploaderAvailable = false;
  }
};

// Export utility to enable mock uploader for testing
export const enableMockUploader = () => {
  localStorage.setItem('mockNativeUploader', 'true');
  initializeNativeUploader();
  console.log('🔧 Mock native uploader enabled. Refresh to see photo attach button.');
};

export const disableMockUploader = () => {
  localStorage.removeItem('mockNativeUploader');
  (window as any).NativeUploaderAvailable = false;
  console.log('❌ Mock native uploader disabled.');
};