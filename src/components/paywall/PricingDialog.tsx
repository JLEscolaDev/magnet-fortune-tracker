import React from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Check, Crown, Sparkles, TrendingUp, Shield, Zap } from 'lucide-react';
import { SUBSCRIPTION_LIMITS, PLAN_PRICES } from '@/config/limits';

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PricingDialog: React.FC<PricingDialogProps> = ({ open, onOpenChange }) => {
  const { isActive, loading } = useSubscription();

  const handleCheckout = (plan: string) => {
    console.log(`Continue to checkout for plan: ${plan}`);
    // TODO: Integrate with Stripe checkout
  };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '€0',
      period: 'forever',
      description: 'Perfect for getting started',
      current: !isActive,
      features: [
        `${SUBSCRIPTION_LIMITS.FREE_DAILY_LIMIT} fortunes per day`,
        `${SUBSCRIPTION_LIMITS.FREE_CATEGORIES_LIMIT} custom categories`,
        'Basic statistics',
        'Calendar view',
        'Mobile responsive',
      ],
      limitations: [
        'Limited daily usage',
        'Basic features only',
        'No priority support',
      ],
      buttonText: 'Current Plan',
      buttonDisabled: true,
      buttonVariant: 'outline' as const,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '€9.99',
      period: 'per month',
      description: 'Unlock your full potential',
      current: isActive,
      popular: true,
      features: [
        'Unlimited daily fortunes',
        `Up to ${SUBSCRIPTION_LIMITS.PRO_CATEGORIES_LIMIT} custom categories`,
        'Advanced statistics & insights',
        'Export data (CSV, PDF)',
        'Priority support',
        'Dark & light themes',
        'Advanced calendar features',
        'Goal tracking & achievements',
        'Data backup & sync',
      ],
      buttonText: isActive ? 'Current Plan' : 'Continue to Checkout',
      buttonDisabled: isActive,
      buttonVariant: isActive ? 'outline' as const : 'default' as const,
      icon: Crown,
    },
  ];

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
          {plans.map((plan) => {
            const Icon = plan.icon;
            
            return (
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
                    {Icon && (
                      <div className="bg-gradient-to-r from-primary to-accent p-2 rounded-full">
                        <Icon className="w-5 h-5 text-primary-foreground" />
                      </div>
                    )}
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                    {plan.current && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  
                  <div className="mb-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">/{plan.period}</span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>

                <CardContent className="pt-0">
                  <Button
                    className={`w-full mb-6 ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90' 
                        : ''
                    }`}
                    variant={plan.buttonVariant}
                    disabled={plan.buttonDisabled || loading}
                    onClick={() => handleCheckout(plan.id)}
                  >
                    {plan.buttonText}
                  </Button>

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald" />
                      What's included:
                    </h4>
                    
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {plan.limitations && (
                      <>
                        <Separator className="my-4" />
                        <ul className="space-y-2">
                          {plan.limitations.map((limitation, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <div className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                              </div>
                              <span>{limitation}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-1">
              <Shield className="w-5 h-5" />
              <span>Secure Payment</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Zap className="w-5 h-5" />
              <span>Instant Access</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <TrendingUp className="w-5 h-5" />
              <span>Cancel Anytime</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4">
            All prices exclude applicable taxes. You can cancel your subscription at any time.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};