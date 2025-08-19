import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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
    console.log('[GET-PRICES] Function started');

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Parse request body
    const { price_ids } = await req.json();
    
    if (!Array.isArray(price_ids) || price_ids.length === 0) {
      throw new Error("price_ids must be a non-empty array");
    }

    console.log('[GET-PRICES] Fetching prices for:', price_ids.length, 'price IDs');

    // Fetch pricing data from Stripe for each price_id
    const pricing = await Promise.all(
      price_ids.map(async (priceId: string) => {
        try {
          const price = await stripe.prices.retrieve(priceId);
          const product = await stripe.products.retrieve(price.product as string);
          
          return {
            price_id: priceId,
            unit_amount: price.unit_amount || 0,
            currency: price.currency || 'eur',
            type: price.type,
            interval: price.type === 'one_time' ? null : price.recurring?.interval || null,
            interval_count: price.recurring?.interval_count || null,
            product_name: product.name
          };
        } catch (error) {
          console.error(`[GET-PRICES] Error fetching price ${priceId}:`, error);
          return null;
        }
      })
    );

    // Filter out failed price fetches
    const validPricing = pricing.filter(p => p !== null);

    console.log('[GET-PRICES] Successfully processed pricing for', validPricing.length, 'prices');

    return new Response(JSON.stringify(validPricing), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('[GET-PRICES] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});