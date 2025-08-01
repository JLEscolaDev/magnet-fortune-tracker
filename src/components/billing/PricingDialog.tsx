import React, { useState } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { redirectToCheckout } from '@/lib/stripe';

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PricingDialog: React.FC<PricingDialogProps> = ({ open, onOpenChange }) => {
  const { isActive, loading: subscriptionLoading } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const plans = [
    {
      id: 'monthly',
      name: 'Pro Monthly',
      price: '€9.99',
      period: 'per month',
      priceId: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY,
      popular: true,
      savings: null,
    },
    {
      id: 'yearly',
      name: 'Pro Yearly',
      price: '€99.99',
      period: 'per year',
      priceId: import.meta.env.VITE_STRIPE_PRICE_PRO_YEARLY,
      popular: false,
      savings: 'Save 17%',
    },
  ];

  const features = [
    'Unlimited daily fortunes',
    'Up to 20 custom categories',
    'Advanced statistics & insights',
    'Export data (CSV, PDF)',
    'Priority support',
    'Advanced calendar features',
    'Goal tracking & achievements',
    'Data backup & sync',
  ];

  const handleCheckout = async (priceId: string, planName: string) => {
    if (!priceId) {
      toast({
        title: 'Configuration Error',
        description: 'Price ID not configured. Please contact support.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(priceId);

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId,
          successUrl: `${window.location.origin}/billing/success`,
          cancelUrl: `${window.location.origin}/billing/cancel`,
        },
      });

      if (error) throw error;

      if (!data?.sessionId) {
        throw new Error('No session ID returned from server');
      }

      await redirectToCheckout(data.sessionId);
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Error',
        description: error instanceof Error ? error.message : 'Failed to start checkout process',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Upgrade to Pro and unlock unlimited fortunes and advanced features
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative transition-all duration-200 ${
                plan.popular 
                  ? 'border-primary shadow-lg scale-105' 
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="bg-gradient-to-r from-primary to-accent p-2 rounded-full">
                    <Crown className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                </div>
                
                <div className="mb-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-1">/{plan.period}</span>
                  {plan.savings && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {plan.savings}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <Button
                  className={`w-full mb-6 ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90' 
                      : ''
                  }`}
                  disabled={isActive || subscriptionLoading || loading === plan.priceId}
                  onClick={() => handleCheckout(plan.priceId, plan.name)}
                >
                  {loading === plan.priceId ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isActive ? (
                    'Current Plan'
                  ) : (
                    'Continue to Checkout'
                  )}
                </Button>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald" />
                    What's included:
                  </h4>
                  
                  <ul className="space-y-2">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          All prices exclude applicable taxes. You can cancel your subscription at any time.
        </div>
      </DialogContent>
    </Dialog>
  );
};