/// <reference lib="deno.ns" />
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

/**
 * upload-fortune-photo
 * 
 * Direct upload endpoint that receives image bytes and uploads them using service role.
 * This bypasses signed URL issues with iOS legacy uploader that uses POST/FormData.
 * 
 * Flow:
 * 1. Validate user auth + fortune ownership + subscription
 * 2. Receive raw image bytes (base64 or binary)
 * 3. Upload directly to storage using service role
 * 4. Upsert fortune_media record
 * 5. Return signed GET URL
 */

const BUILD_TAG = '2026-01-23-direct-upload-v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function getExtensionFromMime(mime: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  return mimeToExt[mime] || 'jpg';
}

serve(async (req) => {
  console.log('upload-fortune-photo: Request received', { BUILD_TAG });

  // Handle CORS preflight
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
    // Validate authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('upload-fortune-photo: No authorization header');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body - expect JSON with base64 image data
    const body = await req.json();
    const {
      fortune_id,
      image_base64,
      mime_type,
      width,
      height,
    } = body ?? {};

    console.log('upload-fortune-photo: Request parsed', {
      fortune_id,
      mime_type,
      has_image: !!image_base64,
      image_length: image_base64?.length || 0,
      width,
      height,
    });

    // Validate required fields
    if (!fortune_id) {
      return new Response(JSON.stringify({ error: 'fortune_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'image_base64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mimeType = mime_type || 'image/jpeg';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return new Response(JSON.stringify({ error: `Invalid mime_type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decode base64 to bytes
    let imageBytes: Uint8Array;
    try {
      // Handle data URL prefix if present
      let base64Data = image_base64;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageBytes = bytes;
    } catch (e) {
      console.error('upload-fortune-photo: Failed to decode base64:', e);
      return new Response(JSON.stringify({ error: 'Invalid base64 image data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('upload-fortune-photo: Image decoded', { size_bytes: imageBytes.length });

    // Check file size
    if (imageBytes.length > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    // Validate user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.log('upload-fortune-photo: Invalid user token:', userError);
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('upload-fortune-photo: User validated:', user.id);

    // Validate fortune ownership
    const { data: fortune, error: fortuneError } = await userClient
      .from('fortunes')
      .select('id, user_id')
      .eq('id', fortune_id)
      .single();

    if (fortuneError || !fortune) {
      console.log('upload-fortune-photo: Fortune not found:', fortuneError);
      return new Response(JSON.stringify({ error: 'Fortune not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (fortune.user_id !== user.id) {
      console.log('upload-fortune-photo: Fortune ownership mismatch');
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check subscription/trial
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
      console.log('upload-fortune-photo: No Pro/Lifetime access');
      return new Response(JSON.stringify({ error: 'Pro/Lifetime subscription required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate path
    const bucket = 'photos';
    const extension = getExtensionFromMime(mimeType);
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    const filePath = `${user.id}/${fortune_id}-${randomSuffix}.${extension}`;

    console.log('upload-fortune-photo: Uploading to storage', { bucket, filePath, size: imageBytes.length });

    // Upload using service role (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from(bucket)
      .upload(filePath, imageBytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error('upload-fortune-photo: Upload failed:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload image' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('upload-fortune-photo: Upload successful:', uploadData);

    // Check for existing media
    const { data: existingMedia } = await userClient
      .from('fortune_media')
      .select('*')
      .eq('fortune_id', fortune_id)
      .maybeSingle();

    const replaced = !!existingMedia;

    // Upsert fortune_media record
    let updatedMedia: { bucket: string; path: string; updated_at: string } | null = null;

    if (replaced) {
      const { data: updateData, error: updateError } = await userClient
        .from('fortune_media')
        .update({
          bucket,
          path: filePath,
          width: width || null,
          height: height || null,
          size_bytes: imageBytes.length,
          mime_type: mimeType,
          updated_at: new Date().toISOString()
        })
        .eq('fortune_id', fortune_id)
        .select('bucket, path, updated_at')
        .single();

      if (updateError) {
        console.error('upload-fortune-photo: Failed to update media record:', updateError);
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
          fortune_id,
          user_id: user.id,
          bucket,
          path: filePath,
          width: width || null,
          height: height || null,
          size_bytes: imageBytes.length,
          mime_type: mimeType
        })
        .select('bucket, path, updated_at')
        .single();

      if (insertError) {
        console.error('upload-fortune-photo: Failed to insert media record:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to save media record' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      updatedMedia = insertData;
    }

    console.log('upload-fortune-photo: Media record saved', { replaced, updatedMedia });

    // Create signed GET URL
    const { data: signedData, error: signedError } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(filePath, 300);

    if (signedError) {
      console.error('upload-fortune-photo: Failed to create signed URL:', signedError);
      // Return success anyway - upload worked
      return new Response(JSON.stringify({
        signedUrl: null,
        replaced,
        media: updatedMedia,
        buildTag: BUILD_TAG
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('upload-fortune-photo: Complete success', { filePath, replaced });

    return new Response(JSON.stringify({
      signedUrl: signedData.signedUrl,
      replaced,
      media: {
        fortune_id,
        bucket: updatedMedia?.bucket || bucket,
        path: updatedMedia?.path || filePath,
        updated_at: updatedMedia?.updated_at
      },
      buildTag: BUILD_TAG
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('upload-fortune-photo: Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
