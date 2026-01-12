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

    // Parse request body
    // path can be with or without bucket prefix (will be normalized)
    const { fortune_id, bucket, path, width, height, size_bytes, mime } = await req.json();
    const rawPath = path;
    console.log('finalize-fortune-photo: Processing for fortune_id:', fortune_id, 'bucket:', bucket, 'rawPath:', rawPath);

    if (!fortune_id || !bucket || !path || !mime) {
      return new Response(JSON.stringify({ error: 'fortune_id, bucket, path, and mime are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize path: strip bucket prefix if present
    const bucketRelativePath = stripBucketPrefix(bucket, path);
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
      .eq('id', fortune_id)
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
          bucket,
          path: bucketRelativePath, // Store bucket-relative path
          width: width || null,
          height: height || null,
          size_bytes: size_bytes || null,
          mime_type: mime,
          updated_at: new Date().toISOString() // Explicitly update timestamp for cache busting
        })
        .eq('fortune_id', fortune_id)
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
          fortune_id,
          user_id: user.id,
          bucket,
          path: bucketRelativePath, // Store bucket-relative path
          width: width || null,
          height: height || null,
          size_bytes: size_bytes || null,
          mime_type: mime
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

    // Verify upload actually exists by listing the folder
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const pathParts = bucketRelativePath.split('/');
    const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : ''; // Get folder path (empty if root)
    const fileName = pathParts[pathParts.length - 1]; // Get file name
    
    console.log('finalize-fortune-photo: Verifying upload exists - bucket:', bucket, 'folderPath:', folderPath || '(root)', 'fileName:', fileName);
    const { data: files, error: listError } = await serviceClient.storage
      .from(bucket)
      .list(folderPath || undefined, {
        limit: 100,
        search: fileName
      });

    if (listError) {
      console.error('finalize-fortune-photo: Failed to list folder:', listError);
      // Continue anyway - might be a permission issue, but log warning
      console.warn('finalize-fortune-photo: Continuing without upload verification due to list error');
    } else {
      const fileExists = files?.some(file => file.name === fileName);
      if (!fileExists) {
        console.error('finalize-fortune-photo: UPLOAD_NOT_PERSISTED - File not found after upload - bucket:', bucket, 'bucketRelativePath:', bucketRelativePath);
        return new Response(JSON.stringify({ 
          error: 'UPLOAD_NOT_PERSISTED',
          message: 'The uploaded file was not found in storage. Upload may have failed or used incorrect method.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('finalize-fortune-photo: UPLOAD_VERIFIED - File exists in storage - bucket:', bucket, 'bucketRelativePath:', bucketRelativePath);
    }

    // Create signed GET URL for immediate use
    // Use bucketRelativePath (NO bucket prefix) for Storage API
    console.log('finalize-fortune-photo: Creating signed URL - bucket:', bucket, 'bucketRelativePath:', bucketRelativePath);
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(bucketRelativePath, 300); // 5 minutes

    if (signedUrlError) {
      // Only retry on "Object not found" errors (might be timing issue)
      if (signedUrlError.message?.includes('Object not found') || signedUrlError.message?.includes('not found')) {
        console.error('finalize-fortune-photo: Failed to create signed URL - Object not found (retriable) - bucket:', bucket, 'bucketRelativePath:', bucketRelativePath, 'error:', signedUrlError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create signed URL: Object not found',
          retriable: true 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.error('finalize-fortune-photo: Failed to create signed URL - bucket:', bucket, 'bucketRelativePath:', bucketRelativePath, 'error:', signedUrlError);
      return new Response(JSON.stringify({ error: 'Failed to create signed URL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('finalize-fortune-photo: SIGNED_URL_OK - Media finalized successfully - bucket:', bucket, 'bucketRelativePath:', bucketRelativePath);

    // Return updated media record so frontend can confirm DB update
    // Include updated_at from DB to ensure cache invalidation
    return new Response(JSON.stringify({
      signedUrl: signedUrlData.signedUrl,
      replaced,
      media: {
        fortune_id: fortune_id,
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