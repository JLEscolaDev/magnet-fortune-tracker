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
  // Signed-upload support (Supabase createSignedUploadUrl + uploadToSignedUrl)
  signedUploadToken?: string;
  isSignedUploadUrl: boolean;
  debug: {
    receivedKeys: string[];
    chosen: {
      uploadUrl: string;
      bucketRelativePath: string;
      formFieldName: string;
      requiredHeaders: Record<string, string>;
      bucket: string;
      uploadMethod: 'POST_MULTIPART' | 'PUT';
      signedUploadToken?: string;
      isSignedUploadUrl: boolean;
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
  // Extract signed upload token when using createSignedUploadUrl()
  const signedUploadToken = (ticket.token || ticket.uploadToken || ticket.signedUploadToken || ticket.signed_upload_token) as string | undefined;

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

  // Extract optional fields with safe defaults
  // NOTE: For signed upload URLs we should NOT force custom headers like x-upsert.
  // Some storage signed URLs are strict about headers and CORS.
  const requiredHeaders = (ticket.requiredHeaders || ticket.headers || {}) as Record<string, string>;

  // Detect signed endpoints more precisely.
  // - `/storage/v1/object/upload/sign/` is a *signed upload* endpoint (multipart POST unless you have a token for uploadToSignedUrl)
  // - `/storage/v1/object/sign/` is typically used for *signed download URL creation* (not an upload target)
  const uploadUrlLower = String(uploadUrl).toLowerCase();
  const looksLikeSignedUploadEndpoint = uploadUrlLower.includes('/storage/v1/object/upload/sign/');
  const looksLikeSignedSignEndpoint = uploadUrlLower.includes('/storage/v1/object/sign/');
  const hasTokenInUrl = uploadUrlLower.includes('token=');

  // We consider it a signed-upload flow if:
  // - it's the signed upload endpoint, OR
  // - we got a token from createSignedUploadUrl(), OR
  // - the URL itself has a token query param.
  const looksLikeSignedUploadUrl =
    looksLikeSignedUploadEndpoint ||
    hasTokenInUrl ||
    typeof signedUploadToken === 'string';

  // Decide upload method.
  // IMPORTANT:
  // - Signed upload endpoints (`.../object/upload/sign/...`) are expected to be `POST` multipart/form-data
  //   when you don't use the `uploadToSignedUrl(path, token, file)` helper.
  // - Using `PUT` against that endpoint can return 200 in some environments but still not persist the object.
  let uploadMethod: 'POST_MULTIPART' | 'PUT' = 'PUT';
  if (looksLikeSignedUploadUrl) {
    if (looksLikeSignedUploadEndpoint && !signedUploadToken) {
      // No token available: fall back to multipart POST to the signed upload endpoint.
      uploadMethod = 'POST_MULTIPART';
    } else {
      // Token-present signed uploads (or direct signed PUT URLs) can use PUT.
      uploadMethod = 'PUT';
    }
  } else if (ticket.uploadMethod) {
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

  // Default form field name (only relevant for multipart)
  const formFieldName = (ticket.formFieldName || 'file') as string;

  // For non-signed direct PUT uploads, allow overwrites via x-upsert.
  // For signed URLs, do NOT attach x-upsert.
  const allowUpsertHeader = !looksLikeSignedUploadUrl;
  if (allowUpsertHeader) {
    if (!requiredHeaders['x-upsert']) {
      requiredHeaders['x-upsert'] = 'true';
    }
  } else {
    // Ensure we don't accidentally send it
    if (requiredHeaders['x-upsert']) {
      delete requiredHeaders['x-upsert'];
    }
  }

  // Extract bucket last so we can keep the function structure similar
  const bucket = (ticket.bucket || 'photos') as string;

  return {
    uploadUrl,
    bucketRelativePath,
    formFieldName,
    requiredHeaders,
    bucket,
    uploadMethod,
    signedUploadToken,
    isSignedUploadUrl: looksLikeSignedUploadUrl,
    debug: {
      receivedKeys,
      chosen: {
        uploadUrl,
        bucketRelativePath,
        formFieldName,
        requiredHeaders,
        bucket,
        uploadMethod,
        signedUploadToken,
        isSignedUploadUrl: looksLikeSignedUploadUrl
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
    console.log('[NATIVE-UPLOADER] STAGE=guard', {
      fortuneId,
      attempt,
      info: 'Upload already in progress for this fortune (returning cancelled=true to avoid retries)'
    });

    resolveJS({
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
    console.log('[NATIVE-UPLOADER] STAGE=upload', {
      fortuneId,
      attempt,
      method: normalized.uploadMethod,
      isSignedUploadUrl: normalized.isSignedUploadUrl,
      hasSignedUploadToken: !!normalized.signedUploadToken
    });

    let uploadResponse: Response;

    // Prefer Supabase JS helper for signed uploads when token is available.
    // This matches Supabase docs: createSignedUploadUrl() + uploadToSignedUrl(path, token, fileBody, options)
    // and avoids subtle method/header mismatches in WebViews.
    if (normalized.isSignedUploadUrl && normalized.signedUploadToken) {
      const { data, error } = await supabase.storage
        .from(normalized.bucket)
        .uploadToSignedUrl(
          normalized.bucketRelativePath,
          normalized.signedUploadToken,
          file,
          {
            contentType: file.type || 'image/jpeg'
          }
        );

      if (error) {
        const errorMsg = `Signed upload failed: ${error.message}`;
        console.log('[NATIVE-UPLOADER] STAGE=upload', { fortuneId, attempt, error: errorMsg });
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
          reason: errorMsg
        } as NativeUploaderResult & { error?: boolean; stage?: string; reason?: string };
        console.log('[NATIVE-UPLOADER] resolveJS →', JSON.stringify(errorResult));
        resolveJS(errorResult);
        return;
      }

      // uploadToSignedUrl returns metadata; treat as OK.
      uploadResponse = new Response(JSON.stringify(data ?? {}), { status: 200 });

    } else if (normalized.uploadMethod === 'POST_MULTIPART') {
      // POST multipart/form-data upload
      // IMPORTANT: Do NOT attach custom headers for multipart uploads.
      // The browser/webview must set Content-Type + boundary automatically.
      const formData = new FormData();

      // Provide a filename when possible (helps some runtimes)
      const filename = file instanceof File && file.name ? file.name : `fortune-${fortuneId}.jpg`;
      formData.append(normalized.formFieldName, file, filename);

      uploadResponse = await fetch(normalized.uploadUrl, {
        method: 'POST',
        body: formData
      });

    } else {
      // PUT upload fallback (when we only have a signed URL but not the token)
      // Keep headers minimal.
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

    // Extra sanity check log to help diagnose "upload says OK but object not found" issues:
    console.log('[NATIVE-UPLOADER] STAGE=upload_ok', {
      fortuneId,
      attempt,
      bucket: normalized.bucket,
      path: normalized.bucketRelativePath,
      isSignedUploadUrl: normalized.isSignedUploadUrl,
      usedSignedUploadToken: !!normalized.signedUploadToken
    });

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