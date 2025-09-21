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
}

export interface NativeUploader {
  pickAndUploadFortunePhoto: (options: NativeUploaderOptions) => Promise<NativeUploaderResult>;
}

declare global {
  interface Window {
    NativeUploaderAvailable?: boolean;
    NativeUploader?: NativeUploader;
  }
}

export {};