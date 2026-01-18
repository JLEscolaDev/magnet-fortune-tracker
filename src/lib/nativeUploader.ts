import { NativeUploaderOptions, NativeUploaderResult, NativeUploader } from '@/types/native';
import { supabase } from '@/integrations/supabase/client';
import { getAccessToken } from '@/integrations/supabase/auth';

// Normalized ticket structure
interface NormalizedTicket {
  uploadUrl: string;
  bucketRelativePath: string;
  formFieldName: string;
  requiredHeaders: Record<string, string>;
  bucket: string;
  uploadMethod: 'POST_MULTIPART' | 'PUT';
  debug: {
    receivedKeys: string[];
    chosen: {
      uploadUrl: string;
      bucketRelativePath: string;
      formFieldName: string;
      requiredHeaders: Record<string, string>;
      bucket: string;
      uploadMethod: 'POST_MULTIPART' | 'PUT';
    };
  };
}

// Tolerant ticket normalization function
function normalizeUploadTicket(rawTicket: unknown): NormalizedTicket | { error: string; reason: string; receivedKeys: string[]; rawTicketSnippet: Record<string, unknown> } {
  if (!rawTicket || typeof rawTicket !== 'object') {
    const receivedKeys = rawTicket ? Object.keys(rawTicket as object) : [];
    return {
      error: 'Invalid ticket format',
      reason: 'Ticket is not an object',
      receivedKeys,
      rawTicketSnippet: rawTicket ? { type: typeof rawTicket } : {}
    };
  }

  const ticket = rawTicket as Record<string, unknown>;
  const receivedKeys = Object.keys(ticket);

  // Create safe snippet for logging (max 100 chars per string value, no tokens)
  const rawTicketSnippet: Record<string, unknown> = {};
  for (const key of receivedKeys) {
    const value = ticket[key];
    if (typeof value === 'string') {
      rawTicketSnippet[key] = value.length > 100 ? value.substring(0, 100) + '...' : value;
    } else if (typeof value === 'object' && value !== null) {
      rawTicketSnippet[key] = Array.isArray(value) ? `[Array(${value.length})]` : `[Object(${Object.keys(value as object).length})]`;
    } else {
      rawTicketSnippet[key] = value;
    }
  }

  // Extract uploadUrl from url, uploadUrl, upload_url, or signedUrl
  const uploadUrl = (ticket.url || ticket.uploadUrl || ticket.upload_url || ticket.signedUrl) as string | undefined;
  
  // Extract bucketRelativePath from bucketRelativePath or path
  const bucketRelativePath = (ticket.bucketRelativePath || ticket.path) as string | undefined;

  // Validate required fields with detailed error including ticket keys
  if (!uploadUrl || typeof uploadUrl !== 'string') {
    console.error('[NATIVE-UPLOADER] Ticket validation failed: Missing uploadUrl', {
      receivedKeys,
      ticketKeys: receivedKeys
    });
    return {
      error: 'Missing uploadUrl',
      reason: `uploadUrl missing or invalid. Expected field: url, uploadUrl, upload_url, or signedUrl. Got keys: ${receivedKeys.join(', ')}`,
      receivedKeys,
      rawTicketSnippet
    };
  }

  if (!bucketRelativePath || typeof bucketRelativePath !== 'string') {
    console.error('[NATIVE-UPLOADER] Ticket validation failed: Missing bucketRelativePath', {
      receivedKeys,
      ticketKeys: receivedKeys
    });
    return {
      error: 'Missing bucketRelativePath',
      reason: `bucketRelativePath missing or invalid. Expected field: bucketRelativePath or path. Got keys: ${receivedKeys.join(', ')}`,
      receivedKeys,
      rawTicketSnippet
    };
  }

  // Extract optional fields with defaults
  const requiredHeaders = (ticket.requiredHeaders || ticket.headers || { 'x-upsert': 'true' }) as Record<string, string>;
  const formFieldName = (ticket.formFieldName || 'file') as string;
  const bucket = (ticket.bucket || 'photos') as string;
  
  // Determine upload method
  let uploadMethod: 'POST_MULTIPART' | 'PUT' = 'PUT';
  if (ticket.uploadMethod) {
    const method = String(ticket.uploadMethod).toUpperCase();
    if (method === 'POST_MULTIPART' || method === 'POST') {
      uploadMethod = 'POST_MULTIPART';
    } else {
      uploadMethod = 'PUT';
    }
  } else if (ticket.formFieldName !== undefined) {
    // If formFieldName exists in ticket, infer POST_MULTIPART
    uploadMethod = 'POST_MULTIPART';
  }

  // Ensure x-upsert is in headers if not present
  if (!requiredHeaders['x-upsert']) {
    requiredHeaders['x-upsert'] = 'true';
  }

  return {
    uploadUrl,
    bucketRelativePath,
    formFieldName,
    requiredHeaders,
    bucket,
    uploadMethod,
    debug: {
      receivedKeys,
      chosen: {
        uploadUrl,
        bucketRelativePath,
        formFieldName,
        requiredHeaders,
        bucket,
        uploadMethod
      }
    }
  };
}

// Process and upload function - used by both mock and native uploaders
// Track in-flight operations per fortuneId to prevent duplicate runs
const inFlightOperations = new Map<string, boolean>();

async function processAndUpload(
  options: NativeUploaderOptions,
  file: File | Blob,
  resolveJS: (result: NativeUploaderResult) => void,
  attempt: number = 1
): Promise<void> {
  const fortuneId = options.fortuneId;
  
  // Guard against duplicate runs per fortuneId
  if (inFlightOperations.get(fortuneId)) {
    console.log('[NATIVE-UPLOADER] STAGE=guard', { fortuneId, attempt, error: 'Upload already in progress for this fortune' });
    resolveJS({
      bucket: 'photos',
      path: '',
      mime: '',
      width: 0,
      height: 0,
      sizeBytes: 0,
      signedUrl: '',
      replaced: false,
      cancelled: false,
      error: true,
      stage: 'guard',
      reason: 'Upload already in progress'
    } as NativeUploaderResult & { error?: boolean; stage?: string; reason?: string });
    return;
  }

  inFlightOperations.set(fortuneId, true);

  try {
    // Step 1: Request ticket
    console.log('[NATIVE-UPLOADER] STAGE=pick', { fortuneId, attempt });
    const { callEdge } = await import('./edge-functions');
    
    // Call edge function and capture response
    const ticketResponse = await callEdge('issue-fortune-upload-ticket', {
      fortune_id: fortuneId,
      mime: file.type || 'image/jpeg'
    });

    if (ticketResponse.error) {
      console.log('[NATIVE-UPLOADER] STAGE=ticket', { fortuneId, attempt, error: ticketResponse.error });
      const errorResult = {
        bucket: 'photos',
        path: '',
        mime: '',
        width: 0,
        height: 0,
        sizeBytes: 0,
        signedUrl: '',
        replaced: false,
        cancelled: false,
        error: true,
        stage: 'ticket',
        reason: ticketResponse.error
      } as NativeUploaderResult & { error?: boolean; stage?: string; reason?: string };
      console.log('[NATIVE-UPLOADER] resolveJS →', JSON.stringify(errorResult));
      resolveJS(errorResult);
      return;
    }

    // Normalize ticket with tolerant parsing
    const normalized = normalizeUploadTicket(ticketResponse.data);
    
    if ('error' in normalized) {
      console.log('[NATIVE-UPLOADER] STAGE=ticket', { 
        fortuneId, 
        attempt, 
        error: normalized.reason,
        ticketKeys: normalized.receivedKeys
      });
      const errorResult = {
        bucket: 'photos',
        path: '',
        mime: '',
        width: 0,
        height: 0,
        sizeBytes: 0,
        signedUrl: '',
        replaced: false,
        cancelled: false,
        error: true,
        stage: 'ticket',
        reason: normalized.reason,
        receivedKeys: normalized.receivedKeys,
        rawTicketSnippet: normalized.rawTicketSnippet
      } as NativeUploaderResult & { error?: boolean; stage?: string; reason?: string; receivedKeys?: string[]; rawTicketSnippet?: Record<string, unknown> };
      console.log('[NATIVE-UPLOADER] resolveJS →', JSON.stringify(errorResult));
      resolveJS(errorResult);
      return;
    }

    console.log('[NATIVE-UPLOADER] STAGE=ticket', { 
      fortuneId, 
      attempt, 
      bucket: normalized.bucket,
      bucketRelativePath: normalized.bucketRelativePath,
      uploadMethod: normalized.uploadMethod
    });

    // Step 2: Upload file
    console.log('[NATIVE-UPLOADER] STAGE=upload', { fortuneId, attempt, method: normalized.uploadMethod });

    let uploadResponse: Response;
    
    if (normalized.uploadMethod === 'POST_MULTIPART') {
      // POST multipart/form-data upload
      const formData = new FormData();
      formData.append(normalized.formFieldName, file);
      
      uploadResponse = await fetch(normalized.uploadUrl, {
        method: 'POST',
        headers: normalized.requiredHeaders,
        body: formData
      });
    } else {
      // PUT upload
      uploadResponse = await fetch(normalized.uploadUrl, {
        method: 'PUT',
        headers: {
          ...normalized.requiredHeaders,
          'Content-Type': file.type || 'image/jpeg'
        },
        body: file
      });
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => uploadResponse.statusText);
      const error = `Upload failed: ${uploadResponse.status} ${errorText}`;
      console.log('[NATIVE-UPLOADER] STAGE=upload', { fortuneId, attempt, error });
      const errorResult = {
        bucket: normalized.bucket,
        path: normalized.bucketRelativePath,
        mime: file.type || 'image/jpeg',
        width: 0,
        height: 0,
        sizeBytes: file.size,
        signedUrl: '',
        replaced: false,
        cancelled: false,
        error: true,
        stage: 'upload',
        reason: error
      } as NativeUploaderResult & { error?: boolean; stage?: string; reason?: string };
      console.log('[NATIVE-UPLOADER] resolveJS →', JSON.stringify(errorResult));
      resolveJS(errorResult);
      return;
    }

    // Step 3: Get image dimensions
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };
    });

    // Step 4: Finalize - ALWAYS include bucket field
    console.log('[NATIVE-UPLOADER] STAGE=finalize', { fortuneId, attempt });
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
      fortune_id: fortuneId,
      bucket: normalized.bucket, // Always include bucket
      path: normalized.bucketRelativePath,
      width: img.width,
      height: img.height,
      size_bytes: file.size,
      mime: file.type || 'image/jpeg'
    });

    if (finalizeResponse.error || !finalizeResponse.data) {
      const error = finalizeResponse.error || 'Failed to finalize photo';
      console.log('[NATIVE-UPLOADER] STAGE=finalize', { fortuneId, attempt, error });
      const errorResult = {
        bucket: normalized.bucket,
        path: normalized.bucketRelativePath,
        mime: file.type || 'image/jpeg',
        width: img.width,
        height: img.height,
        sizeBytes: file.size,
        signedUrl: '',
        replaced: false,
        cancelled: false,
        error: true,
        stage: 'finalize',
        reason: error
      } as NativeUploaderResult & { error?: boolean; stage?: string; reason?: string };
      console.log('[NATIVE-UPLOADER] resolveJS →', JSON.stringify(errorResult));
      resolveJS(errorResult);
      return;
    }

    // Success
    console.log('[NATIVE-UPLOADER] STAGE=done', { fortuneId, attempt });
    const successResult = {
      bucket: normalized.bucket,
      path: normalized.bucketRelativePath,
      mime: file.type || 'image/jpeg',
      width: img.width,
      height: img.height,
      sizeBytes: file.size,
      signedUrl: finalizeResponse.data.signedUrl,
      replaced: finalizeResponse.data.replaced,
      cancelled: false,
      pending: false,
      media: finalizeResponse.data.media || undefined
    };
    console.log('[NATIVE-UPLOADER] resolveJS →', JSON.stringify({ ...successResult, signedUrl: '[REDACTED]' }));
    resolveJS(successResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log('[NATIVE-UPLOADER] STAGE=unknown', { fortuneId, attempt, error: errorMessage });
    const errorResult = {
      bucket: 'photos',
      path: '',
      mime: '',
      width: 0,
      height: 0,
      sizeBytes: 0,
      signedUrl: '',
      replaced: false,
      cancelled: false,
      error: true,
      stage: 'unknown',
      reason: errorMessage
    } as NativeUploaderResult & { error?: boolean; stage?: string; reason?: string };
    console.log('[NATIVE-UPLOADER] resolveJS →', JSON.stringify(errorResult));
    resolveJS(errorResult);
  } finally {
    // Always clear the in-flight flag, even on error
    inFlightOperations.delete(fortuneId);
  }
}

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

        // Use shared processAndUpload function
        await processAndUpload(options, file, resolve);
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

// Export functions for use by native iOS code
export { normalizeUploadTicket, processAndUpload };