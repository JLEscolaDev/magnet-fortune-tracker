/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LIST-PRICING] Function started');

    // Initialize Supabase client with service role for database access
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Try to get user features if authenticated
    let userFlags = { isTrialActive: false, earlyBirdEligible: false };
    
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
        
        if (!userError && userData.user) {
          console.log('[LIST-PRICING] Authenticated user found:', userData.user.id);
          
          const { data: features } = await supabaseClient
            .from('user_features')
            .select('is_trial_active, early_bird_redeemed')
            .eq('user_id', userData.user.id)
            .single();
            
          if (features) {
            userFlags = {
              isTrialActive: features.is_trial_active || false,
              earlyBirdEligible: features.is_trial_active && !features.early_bird_redeemed
            };
          }
        }
      } catch (error) {
        console.log('[LIST-PRICING] Auth optional, continuing without user context:', error.message);
      }
    }

    // Fetch plans from database
    const { data: plans, error: plansError } = await supabaseClient
      .from('plans')
      .select('id, name, price_id, level')
      .order('level', { ascending: true });

    if (plansError) throw new Error(`Failed to fetch plans: ${plansError.message}`);
    if (!plans || plans.length === 0) throw new Error('No plans found');

    console.log('[LIST-PRICING] Found plans:', plans.length);

    // Fetch pricing data from Stripe for each plan
    const pricing = await Promise.all(
      plans.map(async (plan) => {
        try {
          const price = await stripe.prices.retrieve(plan.price_id);
          
          // Determine tier from plan name
          const name = plan.name.toLowerCase();
          let tier = 'essential';
          if (name.includes('growth')) tier = 'growth';
          else if (name.includes('pro')) tier = 'pro';
          else if (name.includes('ultimate') || name.includes('lifetime')) tier = 'lifetime';

          // Determine billing cycle
          let billing_cycle = 'monthly';
          if (name.includes('28d')) billing_cycle = '28d';
          else if (name.includes('annual')) billing_cycle = 'annual';
          else if (name.includes('lifetime')) billing_cycle = 'one_time';

          // Check if it's early bird
          const isEarlyBird = name.includes('early bird');

          return {
            id: plan.id,
            name: plan.name,
            tier,
            billing_cycle,
            price_id: plan.price_id,
            isEarlyBird,
            amountCents: price.unit_amount || 0,
            currency: price.currency || 'eur',
            interval: price.type === 'one_time' ? 'one_time' : price.recurring?.interval || 'month',
            intervalCount: price.recurring?.interval_count ?? null
          };
        } catch (error) {
          console.error(`[LIST-PRICING] Error fetching price for plan ${plan.id}:`, error);
          return null;
        }
      })
    );

    // Filter out failed price fetches
    const validPricing = pricing.filter(p => p !== null);

    console.log('[LIST-PRICING] Successfully processed pricing for', validPricing.length, 'plans');

    return new Response(JSON.stringify({
      pricing: validPricing,
      flags: userFlags
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('[LIST-PRICING] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});