// Global types for native bridge functionality

export interface NativeUploaderOptions {
  supabaseUrl: string;
  accessToken: string;
  userId: string;
  fortuneId: string;
}

export interface NativeUploaderResult {
  bucket: string;
  path: string;
  mime: string;
  width: number;
  height: number;
  sizeBytes: number;
  signedUrl: string;
  replaced: boolean;
  cancelled?: boolean;
  pending?: boolean;
  media?: {
    fortune_id: string;
    bucket: string;
    path: string;
    updated_at: string;
  };
}

export interface NativeUploader {
  pickAndUploadFortunePhoto: (options: NativeUploaderOptions) => Promise<NativeUploaderResult>;
}

// ============ NEW: Simplified Photo Picker Interface ============
// This is the new simplified interface for iOS/Android native photo pickers.
// The native code only handles photo selection and returns image bytes.
// All upload logic is handled by Lovable's shared TypeScript code.

export interface NativePhotoPickerResult {
  /** Raw image bytes as Uint8Array */
  bytes: Uint8Array;
  /** MIME type of the image (e.g., 'image/jpeg', 'image/png') */
  mimeType: string;
  /** Image width in pixels (optional) */
  width?: number;
  /** Image height in pixels (optional) */
  height?: number;
  /** True if user cancelled the photo selection */
  cancelled?: boolean;
}

export interface NativePhotoPicker {
  /**
   * Opens native photo picker and returns selected image bytes.
   * Does NOT perform any upload - that's handled by Lovable code.
   */
  pickPhoto: () => Promise<NativePhotoPickerResult>;
}

declare global {
  interface Window {
    // Legacy uploader (iOS injected JavaScript - handles full upload flow)
    NativeUploaderAvailable?: boolean;
    NativeUploader?: NativeUploader;
    
    // NEW: Simplified photo picker (native code only picks photo, Lovable handles upload)
    NativePhotoPickerAvailable?: boolean;
    NativePhotoPicker?: NativePhotoPicker;
  }
}

export {};