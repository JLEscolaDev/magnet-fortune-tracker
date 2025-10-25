import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseService.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { plan, priceId, earlyBird, tier, returnUrl } = await req.json();
    if (!plan && !priceId && !earlyBird) throw new Error("Plan, priceId, or earlyBird is required");
    logStep("Request payload", { plan, priceId, earlyBird, tier, returnUrl });

    // Get user profile and trial status
    const { data: userFeatures, error: featuresError } = await supabaseService
      .from("user_features")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (featuresError) {
      logStep("Error fetching user features", { error: featuresError });
      throw new Error("Error fetching user features");
    }

    logStep("User features", userFeatures);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check if customer exists
    let customerId = userFeatures?.stripe_customer_id;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        // Update profile with customer ID
        await supabaseService
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", user.id);
      }
    }

    // Determine price ID
    let finalPriceId: string;
    
    if (earlyBird && tier) {
      // Early bird pricing
      const earlyBirdPriceMap: { [key: string]: string } = {
        'essential': Deno.env.get("PRICE_ESSENTIAL_ANNUAL_EB") || "",
        'growth': Deno.env.get("PRICE_GROWTH_ANNUAL_EB") || "",
        'pro': Deno.env.get("PRICE_PRO_ANNUAL_EB") || "",
      };
      finalPriceId = earlyBirdPriceMap[tier];
      if (!finalPriceId) throw new Error(`Invalid early bird tier: ${tier}`);
    } else if (priceId) {
      // Direct price ID
      finalPriceId = priceId;
    } else if (plan) {
      // Legacy plan mapping
      const priceMap: { [key: string]: string } = {
        'basic_28d': Deno.env.get("PRICE_ESSENTIAL_28D") || "",
        'basic_annual': Deno.env.get("PRICE_ESSENTIAL_ANNUAL") || "",
        'growth_28d': Deno.env.get("PRICE_GROWTH_28D") || "",
        'growth_annual': Deno.env.get("PRICE_GROWTH_ANNUAL") || "",
        'lifetime_oneoff': Deno.env.get("PRICE_LIFETIME_ONEOFF") || "",
        'basic_annual_eb': Deno.env.get("PRICE_ESSENTIAL_ANNUAL_EB") || "",
        'growth_annual_eb': Deno.env.get("PRICE_GROWTH_ANNUAL_EB") || "",
      };
      finalPriceId = priceMap[plan];
      if (!finalPriceId) throw new Error(`Invalid plan: ${plan}`);
    } else {
      throw new Error("No valid price identifier provided");
    }

    // Check early bird eligibility
    if (earlyBird) {
      if (!userFeatures.is_trial_active || userFeatures.early_bird_redeemed) {
        throw new Error("Early bird offer not available");
      }
    }

    // Fetch price details from Stripe to determine if it's one-time or recurring
    const priceObject = await stripe.prices.retrieve(finalPriceId);
    logStep("Price details fetched", { priceId: finalPriceId, type: priceObject.type });

    // Determine tier
    let finalTier = tier;
    if (!finalTier && plan) {
      if (plan.includes('growth')) finalTier = 'growth';
      else if (plan.includes('lifetime')) finalTier = 'lifetime';
      else finalTier = 'essential';
    } else if (!finalTier) {
      finalTier = 'essential';
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const successUrl = returnUrl || `${origin}/billing/success`;
    const cancelUrl = `${origin}/billing/cancel`;

    // Create session based on actual price type from Stripe
    let sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        tier: finalTier,
        plan: plan || `${finalTier}_${earlyBird ? 'annual_eb' : 'direct'}`,
      },
    };

    if (priceObject.type === 'one_time') {
      // One-time payment
      logStep("Creating one-time payment session");
      sessionConfig.mode = 'payment';
      sessionConfig.line_items = [{
        price: finalPriceId,
        quantity: 1,
      }];
    } else {
      // Recurring subscription
      logStep("Creating subscription session");
      sessionConfig.mode = 'subscription';
      sessionConfig.line_items = [{
        price: finalPriceId,
        quantity: 1,
      }];

      // Add promotion code for early bird if using that method and available
      if (earlyBird) {
        const promoCode = finalTier === 'essential' ? 
          Deno.env.get("PROMO_EARLY_BIRD_ESSENTIAL_ANNUAL_CODE") : 
          Deno.env.get("PROMO_EARLY_BIRD_GROWTH_ANNUAL_CODE");
        
        if (promoCode) {
          sessionConfig.discounts = [{ promotion_code: promoCode }];
        }
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});