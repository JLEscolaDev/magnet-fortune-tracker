
// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

/**
 * Required secrets (supabase functions secrets set ...):
 *  - SUPABASE_URL
 *  - SUPABASE_ANON_KEY
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - STRIPE_SECRET_KEY (test or live depending on project)
 *  - SITE_URL (optional, e.g. https://app.yourdomain.com)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    // Initialize service role client for DB operations
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch profile fields (preferred source of truth)
    const { data: profile, error: profileErr } = await serviceClient
      .from('profiles')
      .select('display_name, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id ?? null;

    // Fallback: try the user_features view only if not in profiles
    if (!customerId) {
      const { data: uf } = await serviceClient
        .from('user_features')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single();
      customerId = uf?.stripe_customer_id ?? null;
    }

    // If no customer ID in our database, try to find existing customer in Stripe
    if (!customerId) {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1
      });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        // Update profile with the found customer ID
        await serviceClient
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', user.id);
      }
    }

    // If still no customer ID, create a new customer in Stripe
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: profile?.display_name ?? undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;
      // Update profile with the new customer ID
      await serviceClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    // Parse request body for return URL (support both snake_case and camelCase)
    const body = await req.json().catch(() => ({}));
    
    // Production fallback URL
    const PRODUCTION_URL = 'https://fortune-magnet.vercel.app';
    
    // Use client-provided return_url, or fallback to production
    const computedReturnUrl =
      body.return_url ??
      body.returnUrl ??
      PRODUCTION_URL;
    
    // Create Stripe portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: computedReturnUrl,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error creating portal session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
