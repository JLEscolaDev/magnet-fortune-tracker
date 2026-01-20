/// <reference lib="deno.ns" />
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

// BUILD_TAG for deployment drift detection
const BUILD_TAG = '2026-01-18-signed-upsert';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed MIME types for photo uploads
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const;

type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

// Validate input parameters
function validateInput(fortune_id: unknown, mime: unknown): { valid: boolean; error?: string } {
  if (!fortune_id || typeof fortune_id !== 'string') {
    return { valid: false, error: 'fortune_id is required and must be a string' };
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(fortune_id)) {
    return { valid: false, error: 'fortune_id must be a valid UUID' };
  }

  if (!mime || typeof mime !== 'string') {
    return { valid: false, error: 'mime is required and must be a string' };
  }

  if (!ALLOWED_MIME_TYPES.includes(mime as AllowedMimeType)) {
    return { valid: false, error: `mime must be one of: ${ALLOWED_MIME_TYPES.join(', ')}` };
  }

  return { valid: true };
}

// Get file extension from MIME type
function getExtensionFromMime(mime: AllowedMimeType): string {
  const mimeToExt: Record<AllowedMimeType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  return mimeToExt[mime];
}

serve(async (req) => {
  console.log('issue-fortune-upload-ticket: Request received', { BUILD_TAG });
  
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
      console.log('issue-fortune-upload-ticket: No authorization header');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { fortune_id, mime } = body as { fortune_id?: unknown; mime?: unknown };
    
    // Validate input
    const validation = validateInput(fortune_id, mime);
    if (!validation.valid) {
      console.log('issue-fortune-upload-ticket: Validation failed:', validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('issue-fortune-upload-ticket: Processing', { fortune_id, mime });

    // Create clients
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
      console.log('issue-fortune-upload-ticket: Invalid user token:', userError);
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('issue-fortune-upload-ticket: User validated:', user.id);

    // Validate user owns the fortune
    const { data: fortune, error: fortuneError } = await userClient
      .from('fortunes')
      .select('id, user_id')
      .eq('id', fortune_id as string)
      .single();

    if (fortuneError || !fortune) {
      console.log('issue-fortune-upload-ticket: Fortune not found:', fortuneError);
      return new Response(JSON.stringify({ error: 'Fortune not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (fortune.user_id !== user.id) {
      console.log('issue-fortune-upload-ticket: Fortune ownership mismatch');
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
      console.log('issue-fortune-upload-ticket: No access', { BUILD_TAG });
      return new Response(JSON.stringify({ error: 'Pro/Lifetime subscription required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate path
    const extension = getExtensionFromMime(mime as AllowedMimeType);
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    const bucketRelativePath = `${user.id}/${fortune_id}-${randomSuffix}.${extension}`;

    console.log('issue-fortune-upload-ticket: Path:', bucketRelativePath);

    // Create service role client for storage
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Use createSignedUploadUrl with upsert option
    const { data, error } = await serviceClient.storage
      .from('photos')
      .createSignedUploadUrl(bucketRelativePath, {
        upsert: true // Enable upsert in the signed URL token
      });

    if (error) {
      console.error('issue-fortune-upload-ticket: URL creation failed:', error);
      return new Response(JSON.stringify({ error: 'Failed to create upload URL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('issue-fortune-upload-ticket: TICKET_OK', { path: bucketRelativePath, BUILD_TAG });

    // Minimal response with token for SDK uploadToSignedUrl()
    const responseObject = {
      bucket: 'photos',
      path: bucketRelativePath,
      url: data.signedUrl,
      token: data.token,  // Required for supabase.storage.uploadToSignedUrl()
      uploadMethod: 'PUT',
      buildTag: BUILD_TAG
    };

    return new Response(JSON.stringify(responseObject), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('issue-fortune-upload-ticket: Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
