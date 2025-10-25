import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Crown, Sparkles, Lock, X, RefreshCw } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { callEdge } from '@/lib/edge-functions';
import { toast } from 'sonner';
import { useCheckoutSuccess } from '@/hooks/useCheckoutSuccess';

interface PricingPageProps {
  onClose?: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onClose }) => {
  useCheckoutSuccess();
  
  const {
    user, 
    isActive, 
    subscription, 
    userFeatures, 
    plansByCycle, 
    plansLoading, 
    earlyBirdEligible, 
    hasActiveSub 
  } = useSubscription();
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [earlyBirdDismissed, setEarlyBirdDismissed] = useState(false);

  useEffect(() => {
    if (userFeatures) {
      setEarlyBirdDismissed(userFeatures?.early_bird_seen || false);
    }
  }, [userFeatures]);

  const dismissEarlyBird = async () => {
    if (!user) return;
    
    try {
      const { error } = await callEdge('update-profile', { 
        updates: { early_bird_seen: true } 
      });
      
      if (error) throw new Error(error);
      setEarlyBirdDismissed(true);
    } catch (error) {
      console.error('Error dismissing early bird:', error);
      toast.error('Failed to dismiss early bird offer');
    }
  };

  const handleCheckout = async (priceId: string, isEarlyBird = false, tier?: string) => {
    if (!user) {
      toast.error('Please log in to subscribe');
      return;
    }

    const planKey = isEarlyBird ? `eb_${tier}` : priceId;
    setLoading(prev => ({ ...prev, [planKey]: true }));

    try {
      const returnTo = window.location.pathname + window.location.search;
      const body = isEarlyBird 
        ? { earlyBird: true, tier, returnTo }
        : { priceId, returnTo };

      const { data, error } = await callEdge('create-checkout-session', body);

      if (error) throw new Error(error);

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Error starting checkout. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, [planKey]: false }));
    }
  };

  const handleManageBilling = async () => {
    if (!user) return;

    try {
      const { data, error } = await callEdge('create-portal-session', {
        returnUrl: window.location.origin + '/settings'
      });

      if (error) throw new Error(error);

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      toast.error('Error opening billing portal. Please try again.');
    }
  };

  // Plan features mapping
  const planFeatures = {
    essential: [
      'Daily fortune tracking',
      'Simple charts & statistics', 
      'Achievement system',
      'Settings & preferences'
    ],
    growth: [
      'Everything in ESSENTIAL',
      'Expanded charts & analytics',
      'Photo uploads per fortune',
      'Calendar review',
      'Backfill previous days'
    ],
    pro: [
      'Everything in GROWTH',
      'Health/mood tracking',
      'Pattern insights',
      'Decision timing advice',
      'Priority support'
    ],
    lifetime: [
      'Everything included!',
      'Lifetime access!',
      'All features available to date!',
      'Priority support!',
      'No recurring payments!'
    ]
  };

  const getPlanTier = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes('essential')) return 'essential';
    if (name.includes('growth')) return 'growth';
    if (name.includes('pro')) return 'pro';
    if (name.includes('lifetime')) return 'lifetime';
    return 'essential';
  };

  const formatPlanName = (planName: string) => {
    const tier = getPlanTier(planName);
    return tier.toUpperCase();
  };

  const getPeriodText = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes('28d')) return 'every 28 days';
    if (name.includes('annual')) return 'per year'; 
    if (name.includes('lifetime')) return 'one-time payment';
    return 'per month';
  };

  const showEarlyBird = earlyBirdEligible && !earlyBirdDismissed;

  const renderPlanCard = (plan: any, tabType: string) => {
    const tier = getPlanTier(plan.name);
    const isEarlyBird = showEarlyBird && tabType === 'annual' && tier !== 'lifetime';
    const isPro = tier === 'pro';
    const isLifetime = tier === 'lifetime';
    const planKey = isEarlyBird ? `eb_${tier}` : plan.price_id;

    return (
      <Card key={plan.id} className={`relative ${tier === 'essential' ? 'ring-2 ring-primary' : ''} ${tier === 'growth' ? 'opacity-90' : ''}`}>
        {tier === 'essential' && (
          <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
            Most Popular
          </Badge>
        )}
        {tier === 'growth' && (
          <Badge variant="outline" className="absolute -top-2 right-2 text-xs">
            Good, but not our best value
          </Badge>
        )}
        {isEarlyBird && (
          <Badge className="absolute -top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <Sparkles className="w-3 h-3 mr-1" />
            Founders Price
          </Badge>
        )}
        {isLifetime && (
          <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
            <Crown className="w-3 h-3 mr-1" />
            Ultimate Value
          </Badge>
        )}
        
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{formatPlanName(plan.name)}</CardTitle>
          <CardDescription className="text-sm">
            {tier === 'essential' ? 'Essential fortune tracking' :
             tier === 'growth' ? 'Enhanced tracking with extras' :
             tier === 'pro' ? 'Advanced insights & support' :
             'All content forever'}
          </CardDescription>
          
          <div className="space-y-2">
            {isEarlyBird && (
              <div className="text-sm text-muted-foreground">
                <span className="text-xs">Limited-time offer</span>
              </div>
            )}
            <div className="text-3xl font-bold text-primary">
              Coming from DB
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {getPeriodText(plan.name)}
              </span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {planFeatures[tier as keyof typeof planFeatures]?.map((feature: string, index: number) => (
              <li key={index} className="flex items-center text-sm">
                <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          
          {isPro ? (
            <Button disabled className="w-full">
              <Lock className="w-4 h-4 mr-2" />
              Coming Soon
            </Button>
          ) : hasActiveSub ? (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleManageBilling}
            >
              Manage Billing
            </Button>
          ) : (
            <Button
              className={`w-full ${isLifetime ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600' : ''}`}
              onClick={() => handleCheckout(plan.price_id, isEarlyBird, tier)}
              disabled={loading[planKey]}
            >
              {loading[planKey] ? 'Loading...' : 
               isLifetime ? 'Get Lifetime Access' : 'Get Started'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (plansLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  if (plansByCycle['28d'].length === 0 && plansByCycle.annual.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No pricing plans available</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground">
            Unlock the full potential of your fortune tracking journey
          </p>
        </div>

        {/* Early Bird Banner */}
        {showEarlyBird && (
          <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Sparkles className="w-6 h-6 text-orange-500" />
                  <div>
                    <h3 className="font-semibold text-orange-900">Founders Offer</h3>
                    <p className="text-orange-700">
                      Save now before your free period ends! Get annual plans at special early-bird prices.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissEarlyBird}
                  className="text-orange-500 hover:text-orange-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Tabs */}
        <Tabs defaultValue="annual" className="space-y-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="28d">Every 28 Days</TabsTrigger>
            <TabsTrigger value="annual">Annual</TabsTrigger>
          </TabsList>

          <TabsContent value="28d" className="space-y-8">
            <div className="grid md:grid-cols-3 gap-6">
              {plansByCycle['28d'].map(plan => renderPlanCard(plan, '28d'))}
            </div>
            
            {plansByCycle.lifetime && (
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-6">Or Go Lifetime</h3>
                <div className="w-full max-w-md mx-auto">
                  {renderPlanCard(plansByCycle.lifetime, 'lifetime')}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="annual" className="space-y-8">
            <div className="grid md:grid-cols-3 gap-6">
              {plansByCycle.annual.map(plan => renderPlanCard(plan, 'annual'))}
            </div>
            
            {plansByCycle.lifetime && (
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-6">Or Go Lifetime</h3>
                <div className="w-full max-w-md mx-auto">
                  {renderPlanCard(plansByCycle.lifetime, 'lifetime')}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Close button if in modal */}
        {onClose && (
          <div className="text-center">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};