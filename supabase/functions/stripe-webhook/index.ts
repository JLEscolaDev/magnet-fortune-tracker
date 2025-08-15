import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();
  
  let receivedEvent: Stripe.Event;

  try {
    receivedEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider
    );
    logStep("Webhook verified", { type: receivedEvent.type, id: receivedEvent.id });
  } catch (err) {
    logStep("Webhook verification failed", { error: err.message });
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Helper function to resolve user ID
  const resolveUserId = async (clientReferenceId?: string | null, customerId?: string | null): Promise<string | null> => {
    if (clientReferenceId) {
      return clientReferenceId;
    }
    
    if (customerId) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();
      
      return data?.user_id || null;
    }
    
    return null;
  };

  try {
    switch (receivedEvent.type) {
      case "checkout.session.completed": {
        const session = receivedEvent.data.object as Stripe.Checkout.Session;
        logStep("Processing checkout.session.completed", { sessionId: session.id, mode: session.mode });

        const userId = await resolveUserId(session.client_reference_id, session.customer as string);
        if (!userId) {
          logStep("No user ID found for session", { sessionId: session.id });
          break;
        }

        if (session.mode === "payment") {
          // Lifetime payment
          const { error } = await supabase.from("subscriptions").upsert({
            user_id: userId,
            tier: "lifetime",
            status: "active",
            is_lifetime: true,
            stripe_customer_id: session.customer as string,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date("2099-12-31").toISOString(),
            plan_id: "lifetime",
            stripe_price_id: session.metadata?.price_id || null,
          });

          if (error) {
            logStep("Error upserting lifetime subscription", { error, userId });
          } else {
            logStep("Lifetime subscription created", { userId });
          }
        } else if (session.mode === "subscription" && session.subscription) {
          // Regular subscription - will be handled by subscription.created event
          logStep("Subscription checkout completed, waiting for subscription.created event");
        }

        // Mark early bird as redeemed if applicable
        if (session.metadata?.plan?.includes('_eb')) {
          await supabase
            .from("profiles")
            .update({ early_bird_redeemed: true })
            .eq("user_id", userId);
          logStep("Early bird marked as redeemed", { userId });
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = receivedEvent.data.object as Stripe.Subscription;
        logStep(`Processing ${receivedEvent.type}`, { subscriptionId: subscription.id, status: subscription.status });

        const userId = await resolveUserId(null, subscription.customer as string);
        if (!userId) {
          logStep("No user ID found for subscription", { subscriptionId: subscription.id });
          break;
        }

        // Determine tier from price
        const priceId = subscription.items.data[0]?.price.id;
        let tier = "basic";
        if (priceId?.includes("growth") || priceId === Deno.env.get("PRICE_GROWTH_28D") || priceId === Deno.env.get("PRICE_GROWTH_ANNUAL")) {
          tier = "growth";
        }

        const { error } = await supabase.from("subscriptions").upsert({
          user_id: userId,
          tier: tier,
          status: subscription.status,
          is_lifetime: false,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          plan_id: priceId || "",
          stripe_price_id: priceId || null,
        });

        if (error) {
          logStep("Error upserting subscription", { error, userId, subscriptionId: subscription.id });
        } else {
          logStep("Subscription upserted successfully", { userId, tier, status: subscription.status });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = receivedEvent.data.object as Stripe.Subscription;
        logStep("Processing customer.subscription.deleted", { subscriptionId: subscription.id });

        const userId = await resolveUserId(null, subscription.customer as string);
        if (!userId) {
          logStep("No user ID found for deleted subscription", { subscriptionId: subscription.id });
          break;
        }

        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("user_id", userId)
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error updating canceled subscription", { error, userId });
        } else {
          logStep("Subscription marked as canceled", { userId });
        }

        break;
      }

      case "invoice.paid": {
        const invoice = receivedEvent.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          logStep("Processing invoice.paid for subscription", { invoiceId: invoice.id, subscriptionId: invoice.subscription });
          
          const userId = await resolveUserId(null, invoice.customer as string);
          if (userId) {
            // Update subscription status to active
            await supabase
              .from("subscriptions")
              .update({ status: "active" })
              .eq("user_id", userId)
              .eq("stripe_subscription_id", invoice.subscription as string);
            
            logStep("Subscription status updated to active", { userId, subscriptionId: invoice.subscription });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = receivedEvent.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          logStep("Processing invoice.payment_failed for subscription", { invoiceId: invoice.id, subscriptionId: invoice.subscription });
          
          const userId = await resolveUserId(null, invoice.customer as string);
          if (userId) {
            // Update subscription status to past_due
            await supabase
              .from("subscriptions")
              .update({ status: "past_due" })
              .eq("user_id", userId)
              .eq("stripe_subscription_id", invoice.subscription as string);
            
            logStep("Subscription status updated to past_due", { userId, subscriptionId: invoice.subscription });
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: receivedEvent.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR processing webhook", { error: error.message, type: receivedEvent.type });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});