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

    const { plan, returnUrl } = await req.json();
    if (!plan) throw new Error("Plan is required");
    logStep("Request payload", { plan, returnUrl });

    // Get user profile and trial status
    const { data: userFeatures, error: featuresError } = await supabaseService
      .from("user_features_v")
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

    // Plan to price mapping
    const priceMap: { [key: string]: string } = {
      'basic_28d': Deno.env.get("PRICE_BASIC_28D") || "",
      'basic_annual': Deno.env.get("PRICE_BASIC_ANNUAL") || "",
      'growth_28d': Deno.env.get("PRICE_GROWTH_28D") || "",
      'growth_annual': Deno.env.get("PRICE_GROWTH_ANNUAL") || "",
      'lifetime_oneoff': Deno.env.get("PRICE_LIFETIME_ONEOFF") || "",
      'basic_annual_eb': Deno.env.get("PRICE_BASIC_ANNUAL_EB") || "",
      'growth_annual_eb': Deno.env.get("PRICE_GROWTH_ANNUAL_EB") || "",
    };

    const priceId = priceMap[plan];
    if (!priceId) throw new Error(`Invalid plan: ${plan}`);

    // Check early bird eligibility
    const isEarlyBird = plan.includes('_eb');
    if (isEarlyBird) {
      if (!userFeatures.is_trial_active || userFeatures.early_bird_redeemed) {
        throw new Error("Early bird offer not available");
      }
    }

    // Determine tier from plan
    let tier = 'basic';
    if (plan.includes('growth')) tier = 'growth';
    else if (plan.includes('lifetime')) tier = 'lifetime';

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const successUrl = returnUrl || `${origin}/billing/success`;
    const cancelUrl = `${origin}/billing/cancel`;

    // Create session based on plan type
    let sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        tier: tier,
        plan: plan,
      },
    };

    if (plan === 'lifetime_oneoff') {
      // One-time payment
      sessionConfig.mode = 'payment';
      sessionConfig.line_items = [{
        price: priceId,
        quantity: 1,
      }];
    } else {
      // Subscription
      sessionConfig.mode = 'subscription';
      sessionConfig.line_items = [{
        price: priceId,
        quantity: 1,
      }];

      // Add promotion code for early bird if using that method
      const promoCode = isEarlyBird ? 
        (plan.includes('basic') ? Deno.env.get("PROMO_EARLY_BIRD_BASIC_ANNUAL_CODE") : Deno.env.get("PROMO_EARLY_BIRD_GROWTH_ANNUAL_CODE"))
        : null;
      
      if (promoCode && isEarlyBird) {
        sessionConfig.discounts = [{ promotion_code: promoCode }];
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