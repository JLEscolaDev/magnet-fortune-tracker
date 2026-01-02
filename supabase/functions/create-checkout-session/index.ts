import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed tiers for validation
const ALLOWED_TIERS = ['essential', 'growth', 'pro', 'lifetime'] as const;
type AllowedTier = typeof ALLOWED_TIERS[number];

// Allowed plans for validation
const ALLOWED_PLANS = [
  'basic_28d',
  'basic_annual',
  'growth_28d',
  'growth_annual',
  'lifetime_oneoff',
  'basic_annual_eb',
  'growth_annual_eb'
] as const;
type AllowedPlan = typeof ALLOWED_PLANS[number];

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Input validation
interface CheckoutInput {
  plan?: string;
  priceId?: string;
  earlyBird?: boolean;
  tier?: string;
  returnTo?: string;
}

function validateCheckoutInput(body: CheckoutInput): { valid: boolean; error?: string } {
  // At least one of plan, priceId, or earlyBird must be provided
  if (!body.plan && !body.priceId && !body.earlyBird) {
    return { valid: false, error: 'Plan, priceId, or earlyBird is required' };
  }

  // Validate plan if provided
  if (body.plan !== undefined) {
    if (typeof body.plan !== 'string') {
      return { valid: false, error: 'Plan must be a string' };
    }
    if (!ALLOWED_PLANS.includes(body.plan as AllowedPlan)) {
      return { valid: false, error: `Invalid plan: ${body.plan}` };
    }
  }

  // Validate priceId if provided (Stripe price ID format)
  if (body.priceId !== undefined) {
    if (typeof body.priceId !== 'string') {
      return { valid: false, error: 'priceId must be a string' };
    }
    // Stripe price IDs start with 'price_'
    if (!body.priceId.startsWith('price_')) {
      return { valid: false, error: 'Invalid priceId format' };
    }
    if (body.priceId.length > 100) {
      return { valid: false, error: 'priceId too long' };
    }
  }

  // Validate earlyBird if provided
  if (body.earlyBird !== undefined && typeof body.earlyBird !== 'boolean') {
    return { valid: false, error: 'earlyBird must be a boolean' };
  }

  // Validate tier if provided
  if (body.tier !== undefined) {
    if (typeof body.tier !== 'string') {
      return { valid: false, error: 'tier must be a string' };
    }
    if (!ALLOWED_TIERS.includes(body.tier as AllowedTier)) {
      return { valid: false, error: `Invalid tier: ${body.tier}` };
    }
  }

  // Validate returnTo if provided
  if (body.returnTo !== undefined) {
    if (typeof body.returnTo !== 'string') {
      return { valid: false, error: 'returnTo must be a string' };
    }
    if (body.returnTo.length > 500) {
      return { valid: false, error: 'returnTo too long' };
    }
  }

  return { valid: true };
}

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

    // Parse request body
    let body: CheckoutInput;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate input
    const validation = validateCheckoutInput(body);
    if (!validation.valid) {
      logStep("Validation failed", { error: validation.error });
      return new Response(JSON.stringify({ error: validation.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { plan, priceId, earlyBird, tier, returnTo } = body;
    logStep("Request payload", { plan, priceId, earlyBird, tier, returnTo });

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
      const earlyBirdPriceMap: Record<string, string> = {
        'essential': Deno.env.get("PRICE_ESSENTIAL_ANNUAL_EB") || "",
        'growth': Deno.env.get("PRICE_GROWTH_ANNUAL_EB") || "",
        'pro': Deno.env.get("PRICE_PRO_ANNUAL_EB") || "",
      };
      finalPriceId = earlyBirdPriceMap[tier];
      if (!finalPriceId) throw new Error(`Invalid early bird tier: ${tier}`);
    } else if (priceId) {
      // Direct price ID (already validated format above)
      finalPriceId = priceId;
    } else if (plan) {
      // Legacy plan mapping (already validated above)
      const priceMap: Record<string, string> = {
        'basic_28d': Deno.env.get("PRICE_ESSENTIAL_28D") || "",
        'basic_annual': Deno.env.get("PRICE_ESSENTIAL_ANNUAL") || "",
        'growth_28d': Deno.env.get("PRICE_GROWTH_28D") || "",
        'growth_annual': Deno.env.get("PRICE_GROWTH_ANNUAL") || "",
        'lifetime_oneoff': Deno.env.get("PRICE_LIFETIME_ONEOFF") || "",
        'basic_annual_eb': Deno.env.get("PRICE_ESSENTIAL_ANNUAL_EB") || "",
        'growth_annual_eb': Deno.env.get("PRICE_GROWTH_ANNUAL_EB") || "",
      };
      finalPriceId = priceMap[plan];
      if (!finalPriceId) throw new Error(`Price not configured for plan: ${plan}`);
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

    // Sanitize returnTo to prevent open redirects
    const sanitizeReturnTo = (path?: string): string => {
      if (!path) return '/settings';
      
      // Remove any protocol/domain to ensure it's a relative path
      const cleanPath = path.replace(/^https?:\/\/[^\/]+/, '');
      
      // Allow-list of safe prefixes
      const allowedPrefixes = ['/settings', '/pricing', '/', '/dashboard', '/app', '/account'];
      const isAllowed = allowedPrefixes.some(prefix => cleanPath.startsWith(prefix));
      
      return isAllowed ? cleanPath : '/settings';
    };

    const origin = req.headers.get("origin") || "https://fortune-magnet.vercel.app";
    const safeReturnTo = sanitizeReturnTo(returnTo);
    const successUrl = `${origin}${safeReturnTo}${safeReturnTo.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}${safeReturnTo}`;

    // Create session based on actual price type from Stripe
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId || undefined,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        user_id: user.id,
        tier: finalTier,
        plan: plan || `${finalTier}_${earlyBird ? 'annual_eb' : 'direct'}`,
      },
      mode: priceObject.type === 'one_time' ? 'payment' : 'subscription',
      line_items: [{
        price: finalPriceId,
        quantity: 1,
      }],
    };

    if (priceObject.type === 'one_time') {
      logStep("Creating one-time payment session");
    } else {
      logStep("Creating subscription session");

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
