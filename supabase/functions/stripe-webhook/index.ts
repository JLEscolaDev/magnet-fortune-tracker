import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

type EntitlementTier = "essential" | "growth" | "pro" | "lifetime";

const envPriceIds = () => {
  // 28-day
  const PRICE_ESSENTIAL_28D = Deno.env.get("PRICE_ESSENTIAL_28D") || "";
  const PRICE_GROWTH_28D = Deno.env.get("PRICE_GROWTH_28D") || "";
  const PRICE_PRO_28D = Deno.env.get("PRICE_PRO_28D") || "";

  // Annual
  const PRICE_ESSENTIAL_ANNUAL = Deno.env.get("PRICE_ESSENTIAL_ANNUAL") || "";
  const PRICE_GROWTH_ANNUAL = Deno.env.get("PRICE_GROWTH_ANNUAL") || "";
  const PRICE_PRO_ANNUAL = Deno.env.get("PRICE_PRO_ANNUAL") || "";

  // Early bird annual
  const PRICE_ESSENTIAL_ANNUAL_EB = Deno.env.get("PRICE_ESSENTIAL_ANNUAL_EB") || "";
  const PRICE_GROWTH_ANNUAL_EB = Deno.env.get("PRICE_GROWTH_ANNUAL_EB") || "";
  const PRICE_PRO_ANNUAL_EB = Deno.env.get("PRICE_PRO_ANNUAL_EB") || "";

  // Lifetime one-off
  const PRICE_LIFETIME_ONEOFF = Deno.env.get("PRICE_LIFETIME_ONEOFF") || "";

  return {
    PRICE_ESSENTIAL_28D,
    PRICE_GROWTH_28D,
    PRICE_PRO_28D,
    PRICE_ESSENTIAL_ANNUAL,
    PRICE_GROWTH_ANNUAL,
    PRICE_PRO_ANNUAL,
    PRICE_ESSENTIAL_ANNUAL_EB,
    PRICE_GROWTH_ANNUAL_EB,
    PRICE_PRO_ANNUAL_EB,
    PRICE_LIFETIME_ONEOFF,
  };
};

const tierFromPriceId = (priceId?: string | null): EntitlementTier => {
  if (!priceId) return "essential";

  const p = envPriceIds();

  const proSet = new Set(
    [p.PRICE_PRO_28D, p.PRICE_PRO_ANNUAL, p.PRICE_PRO_ANNUAL_EB].filter(Boolean)
  );
  const growthSet = new Set(
    [p.PRICE_GROWTH_28D, p.PRICE_GROWTH_ANNUAL, p.PRICE_GROWTH_ANNUAL_EB].filter(Boolean)
  );
  const essentialSet = new Set(
    [p.PRICE_ESSENTIAL_28D, p.PRICE_ESSENTIAL_ANNUAL, p.PRICE_ESSENTIAL_ANNUAL_EB].filter(Boolean)
  );

  if (proSet.has(priceId)) return "pro";
  if (growthSet.has(priceId)) return "growth";
  if (essentialSet.has(priceId)) return "essential";

  // Fallback: keep it conservative
  return "essential";
};

serve(async (req) => {
  if (!stripeSecretKey || !webhookSecret) {
    logStep("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    logStep("Missing Stripe-Signature header");
    return new Response("Missing Stripe-Signature", { status: 400 });
  }

  const body = await req.text();
  let receivedEvent: Stripe.Event;

  try {
    receivedEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
    logStep("Webhook verified", { type: receivedEvent.type, id: receivedEvent.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Webhook verification failed", { error: msg });
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const resolveUserId = async (
    clientReferenceId?: string | null,
    customerId?: string | null
  ): Promise<string | null> => {
    if (clientReferenceId) return clientReferenceId;

    if (customerId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (error) {
        logStep("Failed to resolve user_id from customerId", { customerId, error: error.message });
        return null;
      }
      return data?.user_id ?? null;
    }

    return null;
  };

  const getExistingEntitlement = async (userId: string) => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("is_lifetime, status, tier, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logStep("Failed to load existing entitlement", { userId, error: error.message });
      return null;
    }
    return data ?? null;
  };

  const isActiveLifetime = (sub: any | null) =>
    sub?.is_lifetime === true && sub?.status === "active";

  const upsertSubscriptionByUser = async (payload: Record<string, unknown>) => {
    // UNIQUE(user_id) exists in DB (you just added it)
    return supabase.from("subscriptions").upsert(payload as any, { onConflict: "user_id" });
  };

  try {
    switch (receivedEvent.type) {
      case "checkout.session.completed": {
        const session = receivedEvent.data.object as Stripe.Checkout.Session;
        logStep("Processing checkout.session.completed", { sessionId: session.id, mode: session.mode });

        const customerId = typeof session.customer === "string" ? session.customer : null;
        const userId = await resolveUserId(session.client_reference_id, customerId);

        if (!userId) {
          logStep("No user ID found for session", { sessionId: session.id, customerId });
          break;
        }

        // Persist customer id if missing on profile (helps future resolution)
        if (customerId) {
          await supabase
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("user_id", userId);
        }

        if (session.mode === "payment") {
          // One-off payment => lifetime entitlement
          const lifetimeEnd = new Date("2099-12-31").toISOString();

          const { error } = await upsertSubscriptionByUser({
            user_id: userId,
            tier: "lifetime",
            status: "active",
            is_lifetime: true,
            stripe_customer_id: customerId,
            stripe_subscription_id: null,
            current_period_start: new Date().toISOString(),
            current_period_end: lifetimeEnd,
            plan_id: "lifetime",
            stripe_price_id: session.metadata?.price_id ?? null,
            updated_at: new Date().toISOString(),
          });

          if (error) {
            logStep("Error upserting lifetime entitlement", { userId, error: error.message });
          } else {
            logStep("Lifetime entitlement upserted", { userId });
          }
        } else if (session.mode === "subscription" && session.subscription) {
          // Do not upsert here; subscription.created/updated will arrive with full data
          logStep("Subscription checkout completed; waiting for subscription.created/updated", {
            userId,
            subscriptionId: session.subscription,
          });
        }

        // Mark early bird redeemed if applicable
        if (session.metadata?.plan?.includes("_eb")) {
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
        logStep(`Processing ${receivedEvent.type}`, {
          subscriptionId: subscription.id,
          status: subscription.status,
        });

        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        const userId = await resolveUserId(null, customerId);

        if (!userId) {
          logStep("No user ID found for subscription", { subscriptionId: subscription.id, customerId });
          break;
        }

        // If user already has active lifetime, never overwrite it.
        const existing = await getExistingEntitlement(userId);
        if (isActiveLifetime(existing)) {
          logStep("User has active lifetime entitlement; ignoring subscription update", { userId });
          break;
        }

        // Pick first item price (single price per subscription)
        const priceId = subscription.items.data[0]?.price?.id ?? null;
        const tier = tierFromPriceId(priceId);

        const { error } = await upsertSubscriptionByUser({
          user_id: userId,
          tier,
          status: subscription.status,
          is_lifetime: false,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          plan_id: priceId ?? "",
          stripe_price_id: priceId,
          updated_at: new Date().toISOString(),
        });

        if (error) {
          logStep("Error upserting subscription", {
            userId,
            subscriptionId: subscription.id,
            error: error.message,
          });
        } else {
          logStep("Subscription upserted", { userId, tier, status: subscription.status });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = receivedEvent.data.object as Stripe.Subscription;
        logStep("Processing customer.subscription.deleted", { subscriptionId: subscription.id });

        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        const userId = await resolveUserId(null, customerId);

        if (!userId) {
          logStep("No user ID found for deleted subscription", { subscriptionId: subscription.id, customerId });
          break;
        }

        // If lifetime is active, ignore deletes of subscription objects.
        const existing = await getExistingEntitlement(userId);
        if (isActiveLifetime(existing)) {
          logStep("User has active lifetime entitlement; ignoring subscription deleted", { userId });
          break;
        }

        const { error } = await upsertSubscriptionByUser({
          user_id: userId,
          status: "canceled",
          is_lifetime: false,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          current_period_end: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) {
          logStep("Error marking subscription canceled", { userId, error: error.message });
        } else {
          logStep("Subscription marked as canceled", { userId });
        }

        break;
      }

      case "invoice.paid": {
        const invoice = receivedEvent.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        const userId = await resolveUserId(null, customerId);

        logStep("Processing invoice.paid", {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          customerId,
          userId,
        });

        if (!userId) break;

        // If lifetime is active, ignore invoice events.
        const existing = await getExistingEntitlement(userId);
        if (isActiveLifetime(existing)) {
          logStep("User has active lifetime entitlement; ignoring invoice.paid", { userId });
          break;
        }

        // Safety net: Stripe also emits subscription.updated, but we ensure status is consistent.
        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("stripe_subscription_id", invoice.subscription as string);

        if (error) {
          logStep("Error updating subscription status to active", { userId, error: error.message });
        } else {
          logStep("Subscription status updated to active", { userId });
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = receivedEvent.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        const userId = await resolveUserId(null, customerId);

        logStep("Processing invoice.payment_failed", {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          customerId,
          userId,
        });

        if (!userId) break;

        // If lifetime is active, ignore invoice events.
        const existing = await getExistingEntitlement(userId);
        if (isActiveLifetime(existing)) {
          logStep("User has active lifetime entitlement; ignoring invoice.payment_failed", { userId });
          break;
        }

        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("stripe_subscription_id", invoice.subscription as string);

        if (error) {
          logStep("Error updating subscription status to past_due", { userId, error: error.message });
        } else {
          logStep("Subscription status updated to past_due", { userId });
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("ERROR processing webhook", { error: msg, type: receivedEvent.type });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});