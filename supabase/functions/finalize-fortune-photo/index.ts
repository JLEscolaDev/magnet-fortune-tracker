import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

// BUILD_TAG for deployment drift detection
// Update this timestamp when deploying to production
const BUILD_TAG = '2025-01-27T00:00:00Z-finalize-fortune-photo';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normalize path by stripping bucket prefix if present
 * Returns bucket-relative path (NO bucket prefix like "photos/")
 */
function stripBucketPrefix(bucket: string, path: string): string {
  // Handle various prefix formats
  if (path.startsWith(`${bucket}/`)) {
    return path.slice(bucket.length + 1);
  }
  if (path.startsWith(`/${bucket}/`)) {
    return path.slice(bucket.length + 2);
  }
  // Already bucket-relative
  return path;
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

    // Normalize fields with fallbacks and validation
    const fortune_id = requestBody.fortune_id as string | undefined;
    const normalizedBucket = (requestBody.bucket ?? requestBody.bucket_name ?? 'photos') as string;
    const rawPath = (requestBody.path ?? requestBody.bucketRelativePath ?? requestBody.dbPath ?? requestBody.db_path) as string | undefined;
    const normalizedMime = (requestBody.mime ?? requestBody.mime_type) as string | undefined;
    const width = requestBody.width as number | undefined;
    const height = requestBody.height as number | undefined;
    const size_bytes = requestBody.size_bytes as number | undefined;

    console.log('finalize-fortune-photo: Processing for fortune_id:', fortune_id, 'bucket:', normalizedBucket, 'rawPath:', rawPath);

    // Validate required fields and return 400 with clear error listing missing fields
    const missingFields: string[] = [];
    if (!fortune_id || typeof fortune_id !== 'string') {
      missingFields.push('fortune_id');
    }
    if (!rawPath || typeof rawPath !== 'string') {
      missingFields.push('path (or bucketRelativePath/dbPath/db_path)');
    }
    if (!normalizedMime || typeof normalizedMime !== 'string') {
      missingFields.push('mime (or mime_type)');
    }

    if (missingFields.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        missingFields: missingFields
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize path: strip bucket prefix if present
    const bucketRelativePath = stripBucketPrefix(normalizedBucket, rawPath);
    console.log('finalize-fortune-photo: Path normalization - rawPath:', rawPath, 'bucketRelativePath:', bucketRelativePath);

    // Create client with user token for validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

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

    // Check if user has active subscription: lifetime active OR recurring active/trialing
    // Query subscriptions to get status and is_lifetime for server-side access computation
    const { data: subscription } = await userClient
      .from('subscriptions')
      .select('status, is_lifetime')
      .eq('user_id', user.id)
      .maybeSingle();

    // Also check if user is in trial period
    const { data: profile } = await userClient
      .from('profiles')
      .select('trial_ends_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const isInTrial = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
    
    // Compute hasAccess server-side based on subscription status and lifetime flag
    let hasActiveSubscription = false;
    if (subscription) {
      // Lifetime: must have is_lifetime=true AND status='active'
      if (subscription.is_lifetime === true && subscription.status === 'active') {
        hasActiveSubscription = true;
      }
      // Recurring: status must be 'active' or 'trialing' (Stripe is source of truth)
      else if (subscription.status === 'active' || subscription.status === 'trialing') {
        hasActiveSubscription = true;
      }
      // All other statuses (past_due, canceled, unpaid, incomplete, etc.) do NOT grant access
    }

    // Grant access if user has active subscription OR is in trial period
    if (!hasActiveSubscription && !isInTrial) {
      console.log('finalize-fortune-photo: User not Pro/Lifetime or in trial', {
        hasActiveSubscription,
        isInTrial,
        subscriptionStatus: subscription?.status,
        isLifetime: subscription?.is_lifetime
      });
      return new Response(JSON.stringify({ error: 'Pro/Lifetime subscription required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if media already exists for this fortune
    const { data: existingMedia } = await userClient
      .from('fortune_media')
      .select('*')
      .eq('fortune_id', fortune_id)
      .maybeSingle();

    const replaced = !!existingMedia;
    console.log('finalize-fortune-photo: Media replacement status:', replaced);

    // Upsert into fortune_media table - handle unique constraint properly
    // Store bucketRelativePath in DB (canonical format)
    let updatedMedia: { bucket: string; path: string; updated_at: string } | null = null;

    if (replaced) {
      // Update existing record - explicitly set updated_at to ensure cache invalidation
      // Use .select() to return the DB values after update
      const { data: updateData, error: updateError } = await userClient
        .from('fortune_media')
        .update({
          bucket: normalizedBucket,
          path: bucketRelativePath, // Store bucket-relative path
          width: width || null,
          height: height || null,
          size_bytes: size_bytes || null,
          mime_type: normalizedMime,
          updated_at: new Date().toISOString() // Explicitly update timestamp for cache busting
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
      // Insert new record - use .select() to return DB values including updated_at
      const { data: insertData, error: insertError } = await userClient
        .from('fortune_media')
        .insert({
          fortune_id: fortune_id as string,
          user_id: user.id,
          bucket: normalizedBucket,
          path: bucketRelativePath, // Store bucket-relative path
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

    // Log DB update confirmation with the values returned from the database
    if (updatedMedia) {
      console.log('[FINALIZE-PHOTO] DB_UPDATE_CONFIRMED', {
        fortuneId: fortune_id,
        bucket: updatedMedia.bucket,
        path: updatedMedia.path,
        updated_at: updatedMedia.updated_at,
        replaced
      });
    } else {
      console.error('finalize-fortune-photo: No media data returned from DB operation');
      return new Response(JSON.stringify({ error: 'Failed to retrieve updated media record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service client for storage operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // NOTE: Removed file existence verification as it was causing false negatives
    // The file may not be immediately visible in storage listing after upload
    // due to eventual consistency. We trust that the upload succeeded if finalize is called.
    console.log('finalize-fortune-photo: Skipping upload verification - trusting client upload completed');

    // Create signed GET URL for immediate use
    // Use bucketRelativePath (NO bucket prefix) for Storage API
    console.log('finalize-fortune-photo: Creating signed URL - bucket:', normalizedBucket, 'bucketRelativePath:', bucketRelativePath);
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from(normalizedBucket)
      .createSignedUrl(bucketRelativePath, 300); // 5 minutes

    if (signedUrlError) {
      // Only retry on "Object not found" errors (might be timing issue)
      if (signedUrlError.message?.includes('Object not found') || signedUrlError.message?.includes('not found')) {
        console.error('finalize-fortune-photo: Failed to create signed URL - Object not found (retriable) - bucket:', normalizedBucket, 'bucketRelativePath:', bucketRelativePath, 'error:', signedUrlError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create signed URL: Object not found',
          retriable: true 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.error('finalize-fortune-photo: Failed to create signed URL - bucket:', normalizedBucket, 'bucketRelativePath:', bucketRelativePath, 'error:', signedUrlError);
      return new Response(JSON.stringify({ error: 'Failed to create signed URL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('finalize-fortune-photo: SIGNED_URL_OK - Media finalized successfully - bucket:', normalizedBucket, 'bucketRelativePath:', bucketRelativePath);

    // Return updated media record so frontend can confirm DB update
    // Include updated_at from DB to ensure cache invalidation
    return new Response(JSON.stringify({
      signedUrl: signedUrlData.signedUrl,
      replaced,
      media: {
        fortune_id: fortune_id as string,
        bucket: updatedMedia.bucket,
        path: updatedMedia.path,
        updated_at: updatedMedia.updated_at
      },
      // BUILD_TAG for deployment drift detection
      buildTag: BUILD_TAG
    }), {
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