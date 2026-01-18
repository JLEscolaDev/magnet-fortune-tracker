import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

// BUILD_TAG for deployment drift detection
const BUILD_TAG = '2026-01-18-retry-signed-url';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normalize path by stripping bucket prefix if present
 */
function stripBucketPrefix(bucket: string, path: string): string {
  if (path.startsWith(`${bucket}/`)) {
    return path.slice(bucket.length + 1);
  }
  if (path.startsWith(`/${bucket}/`)) {
    return path.slice(bucket.length + 2);
  }
  return path;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Try to create signed URL with retries
 */
async function createSignedUrlWithRetry(
  serviceClient: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
  maxRetries: number = 3,
  initialDelayMs: number = 500
): Promise<{ signedUrl: string } | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data, error } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, 300); // 5 minutes
    
    if (data?.signedUrl) {
      console.log(`finalize-fortune-photo: Signed URL created on attempt ${attempt}`);
      return { signedUrl: data.signedUrl };
    }
    
    lastError = error as Error;
    console.log(`finalize-fortune-photo: Signed URL attempt ${attempt}/${maxRetries} failed:`, error?.message);
    
    if (attempt < maxRetries) {
      const delay = initialDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`finalize-fortune-photo: Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }
  
  console.error('finalize-fortune-photo: All signed URL attempts failed:', lastError?.message);
  return null;
}

serve(async (req) => {
  console.log('finalize-fortune-photo: Request received', { BUILD_TAG });
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('finalize-fortune-photo: No authorization header');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body once
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestBody = body as Record<string, unknown>;

    // Log the full request body for debugging
    console.log('finalize-fortune-photo: Request body keys:', Object.keys(requestBody));

    // Normalize fields with fallbacks and validation
    const fortune_id = requestBody.fortune_id as string | undefined;
    const normalizedBucket = (requestBody.bucket ?? requestBody.bucket_name ?? 'photos') as string;
    const rawPath = (requestBody.path ?? requestBody.bucketRelativePath ?? requestBody.dbPath ?? requestBody.db_path) as string | undefined;
    const normalizedMime = (requestBody.mime ?? requestBody.mime_type ?? 'image/jpeg') as string;
    const width = requestBody.width as number | undefined;
    const height = requestBody.height as number | undefined;
    const size_bytes = requestBody.size_bytes as number | undefined;

    console.log('finalize-fortune-photo: Processing', { fortune_id, bucket: normalizedBucket, rawPath, mime: normalizedMime });

    // Validate required fields
    const missingFields: string[] = [];
    if (!fortune_id || typeof fortune_id !== 'string') {
      missingFields.push('fortune_id');
    }
    if (!rawPath || typeof rawPath !== 'string') {
      missingFields.push('path');
    }

    if (missingFields.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        missingFields
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize path: strip bucket prefix if present
    const bucketRelativePath = stripBucketPrefix(normalizedBucket, rawPath);
    console.log('finalize-fortune-photo: Path normalized:', { rawPath, bucketRelativePath });

    // Create clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.log('finalize-fortune-photo: Invalid user token:', userError);
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('finalize-fortune-photo: User validated:', user.id);

    // Validate user owns the fortune
    const { data: fortune, error: fortuneError } = await userClient
      .from('fortunes')
      .select('id, user_id')
      .eq('id', fortune_id as string)
      .single();

    if (fortuneError || !fortune) {
      console.log('finalize-fortune-photo: Fortune not found:', fortuneError);
      return new Response(JSON.stringify({ error: 'Fortune not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (fortune.user_id !== user.id) {
      console.log('finalize-fortune-photo: Fortune ownership mismatch');
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check subscription/trial access
    const { data: subscription } = await userClient
      .from('subscriptions')
      .select('status, is_lifetime')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: profile } = await userClient
      .from('profiles')
      .select('trial_ends_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const isInTrial = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
    
    let hasActiveSubscription = false;
    if (subscription) {
      if (subscription.is_lifetime === true && subscription.status === 'active') {
        hasActiveSubscription = true;
      } else if (subscription.status === 'active' || subscription.status === 'trialing') {
        hasActiveSubscription = true;
      }
    }

    if (!hasActiveSubscription && !isInTrial) {
      console.log('finalize-fortune-photo: User not Pro/Lifetime or in trial');
      return new Response(JSON.stringify({ error: 'Pro/Lifetime subscription required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if media already exists
    const { data: existingMedia } = await userClient
      .from('fortune_media')
      .select('id, path')
      .eq('fortune_id', fortune_id)
      .maybeSingle();

    const replaced = !!existingMedia;
    console.log('finalize-fortune-photo: Media replacement:', { replaced, existingPath: existingMedia?.path });

    // Upsert into fortune_media table
    let updatedMedia: { bucket: string; path: string; updated_at: string } | null = null;

    if (replaced) {
      const { data: updateData, error: updateError } = await userClient
        .from('fortune_media')
        .update({
          bucket: normalizedBucket,
          path: bucketRelativePath,
          width: width || null,
          height: height || null,
          size_bytes: size_bytes || null,
          mime_type: normalizedMime,
          updated_at: new Date().toISOString()
        })
        .eq('fortune_id', fortune_id as string)
        .select('bucket, path, updated_at')
        .single();
      
      if (updateError) {
        console.error('finalize-fortune-photo: Failed to update media record:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to save media record' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      updatedMedia = updateData;
    } else {
      const { data: insertData, error: insertError } = await userClient
        .from('fortune_media')
        .insert({
          fortune_id: fortune_id as string,
          user_id: user.id,
          bucket: normalizedBucket,
          path: bucketRelativePath,
          width: width || null,
          height: height || null,
          size_bytes: size_bytes || null,
          mime_type: normalizedMime
        })
        .select('bucket, path, updated_at')
        .single();
      
      if (insertError) {
        console.error('finalize-fortune-photo: Failed to insert media record:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to save media record' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      updatedMedia = insertData;
    }

    console.log('[FINALIZE-PHOTO] DB_UPDATE_CONFIRMED', {
      fortuneId: fortune_id,
      bucket: updatedMedia!.bucket,
      path: updatedMedia!.path,
      updated_at: updatedMedia!.updated_at,
      replaced
    });

    // Try to create signed URL with retries (file might not be immediately visible)
    const signedUrlResult = await createSignedUrlWithRetry(
      serviceClient,
      normalizedBucket,
      bucketRelativePath,
      3,  // maxRetries
      1000 // 1 second initial delay
    );

    if (signedUrlResult) {
      console.log('finalize-fortune-photo: SUCCESS with signed URL');
      return new Response(JSON.stringify({
        signedUrl: signedUrlResult.signedUrl,
        replaced,
        media: {
          fortune_id: fortune_id as string,
          bucket: updatedMedia!.bucket,
          path: updatedMedia!.path,
          updated_at: updatedMedia!.updated_at
        },
        buildTag: BUILD_TAG
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If signed URL creation failed but DB was updated, return partial success
    // This allows the client to still work - it can try to fetch the image later
    console.log('finalize-fortune-photo: PARTIAL_SUCCESS - DB updated but signed URL failed');
    return new Response(JSON.stringify({
      signedUrl: null,
      replaced,
      media: {
        fortune_id: fortune_id as string,
        bucket: updatedMedia!.bucket,
        path: updatedMedia!.path,
        updated_at: updatedMedia!.updated_at
      },
      warning: 'File may still be processing - image will appear shortly',
      buildTag: BUILD_TAG
    }), {
      // Return 200 instead of 500 - the operation was partially successful
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('finalize-fortune-photo: Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
