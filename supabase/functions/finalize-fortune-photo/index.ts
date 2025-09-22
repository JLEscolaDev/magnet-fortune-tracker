import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('finalize-fortune-photo: Request received');
  
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
    const { fortune_id, bucket, path, width, height, size_bytes, mime } = await req.json();
    console.log('finalize-fortune-photo: Processing for fortune_id:', fortune_id, 'path:', path);

    if (!fortune_id || !bucket || !path || !mime) {
      return new Response(JSON.stringify({ error: 'fortune_id, bucket, path, and mime are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Check if user is Pro/Lifetime (simplified check - checking for active subscription)
    const { data: subscription } = await userClient
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    // Also check if user is in trial period
    const { data: profile } = await userClient
      .from('profiles')
      .select('trial_ends_at')
      .eq('user_id', user.id)
      .single();

    const isInTrial = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
    const hasActiveSubscription = !!subscription;

    if (!hasActiveSubscription && !isInTrial) {
      console.log('finalize-fortune-photo: User not Pro/Lifetime or in trial');
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

    // Upsert into fortune_media table
    const { error: upsertError } = await userClient
      .from('fortune_media')
      .upsert({
        fortune_id,
        bucket,
        path,
        width: width || null,
        height: height || null,
        size_bytes: size_bytes || null,
        mime_type: mime
      });

    if (upsertError) {
      console.error('finalize-fortune-photo: Failed to save media record:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to save media record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create signed GET URL for immediate use
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, 300); // 5 minutes

    if (signedUrlError) {
      console.error('finalize-fortune-photo: Failed to create signed URL:', signedUrlError);
      return new Response(JSON.stringify({ error: 'Failed to create signed URL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('finalize-fortune-photo: Success - Media finalized');

    return new Response(JSON.stringify({
      signedUrl: signedUrlData.signedUrl,
      replaced
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