import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!stripeSecretKey || !webhookSecret) {
      console.error('Missing Stripe configuration');
      return new Response('Configuration error', { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    // Get raw body and signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response('Missing signature', { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response('Invalid signature', { status: 400 });
    }

    console.log('Processing webhook event:', event.type);

    // Initialize service role client for DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Helper function to resolve user_id
    const resolveUserId = async (
      clientReferenceId?: string | null,
      customerId?: string | null
    ): Promise<string | null> => {
      if (clientReferenceId) {
        return clientReferenceId;
      }

      if (customerId) {
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();
        
        return profile?.user_id || null;
      }

      return null;
    };

    // Process relevant events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          const userId = await resolveUserId(
            session.client_reference_id,
            session.customer as string
          );

          if (!userId) {
            console.error('Could not resolve user_id for checkout session:', session.id);
            break;
          }

          await serviceClient.from('subscriptions').upsert({
            user_id: userId,
            plan_id: subscription.items.data[0].price.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
          });

          console.log('Subscription created for user:', userId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        const userId = await resolveUserId(
          null,
          subscription.customer as string
        );

        if (!userId) {
          console.error('Could not resolve user_id for subscription:', subscription.id);
          break;
        }

        await serviceClient.from('subscriptions').upsert({
          user_id: userId,
          plan_id: subscription.items.data[0].price.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
        });

        console.log('Subscription updated for user:', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const userId = await resolveUserId(
          null,
          subscription.customer as string
        );

        if (!userId) {
          console.error('Could not resolve user_id for deleted subscription:', subscription.id);
          break;
        }

        await serviceClient.from('subscriptions').upsert({
          user_id: userId,
          plan_id: subscription.items.data[0].price.id,
          status: 'canceled',
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
        });

        console.log('Subscription canceled for user:', userId);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal error', { status: 500 });
  }
});