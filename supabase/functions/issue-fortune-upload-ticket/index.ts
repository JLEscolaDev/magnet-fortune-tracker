import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('issue-fortune-upload-ticket: Request received');
  
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
    const { fortune_id, mime } = await req.json();
    console.log('issue-fortune-upload-ticket: Processing for fortune_id:', fortune_id, 'mime:', mime);

    if (!fortune_id || !mime) {
      return new Response(JSON.stringify({ error: 'fortune_id and mime are required' }), {
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
      .eq('id', fortune_id)
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
      console.log('issue-fortune-upload-ticket: User not Pro/Lifetime or in trial');
      return new Response(JSON.stringify({ error: 'Pro/Lifetime subscription required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate file path
    const extension = mime === 'image/jpeg' ? 'jpg' : 'png';
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    const path = `${user.id}/${fortune_id}-${randomSuffix}.${extension}`;

    console.log('issue-fortune-upload-ticket: Generated path:', path);

    // Create service role client for storage operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Create signed upload URL
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from('fortune-photos')
      .createSignedUploadUrl(path, {
        upsert: true
      });

    if (uploadError) {
      console.error('issue-fortune-upload-ticket: Upload URL creation failed:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to create upload URL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('issue-fortune-upload-ticket: Success - URL created');

    return new Response(JSON.stringify({
      bucket: 'fortune-photos',
      path: path,
      url: uploadData.signedUrl,
      headers: {
        'Content-Type': mime
      }
    }), {
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