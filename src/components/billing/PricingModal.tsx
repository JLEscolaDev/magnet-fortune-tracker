import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Crown, Sparkles, Lock, X, RefreshCw } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { callEdge } from '@/lib/edge-functions';
import { toast } from 'sonner';

interface PricingItem {
  id: string;
  name: string;
  tier: string;
  billing_cycle: string;
  price_id: string;
  isEarlyBird: boolean;
  amountCents: number;
  currency: string;
  interval: string;
  intervalCount: number | null;
}

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose }) => {
  const { user, hasActiveSub } = useSubscription();
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [flags, setFlags] = useState({ isTrialActive: false, earlyBirdEligible: false });
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Fetch pricing data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPricing();
    }
  }, [isOpen]);

  const fetchPricing = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await callEdge('list-pricing', {}, false);
      
      if (error) throw new Error(error);
      
      setPricing(data.pricing || []);
      setFlags(data.flags || { isTrialActive: false, earlyBirdEligible: false });
    } catch (error) {
      console.error('Error fetching pricing:', error);
      setError(error instanceof Error ? error.message : 'Failed to load pricing');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (plan: PricingItem) => {
    if (!user) {
      toast.error('Please log in to subscribe');
      return;
    }

    const planKey = plan.price_id;
    setCheckoutLoading(prev => ({ ...prev, [planKey]: true }));

    try {
      const returnTo = window.location.pathname + window.location.search;
      const body = plan.isEarlyBird 
        ? { 
            priceId: plan.price_id,
            earlyBird: true, 
            tier: plan.tier, 
            returnTo
          }
        : { 
            priceId: plan.price_id, 
            returnTo
          };

      const { data, error } = await callEdge('create-checkout-session', body);

      if (error) throw new Error(error);

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Error starting checkout. Please try again.');
    } finally {
      setCheckoutLoading(prev => ({ ...prev, [planKey]: false }));
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

  const formatPrice = (plan: PricingItem) => {
    const amount = (plan.amountCents / 100).toFixed(2);
    const symbol = plan.currency === 'eur' ? '€' : '$';
    
    if (plan.billing_cycle === 'one_time') return `${symbol}${amount} one-time`;
    if (plan.billing_cycle === '28d') return `${symbol}${amount} / 28 days`;
    if (plan.billing_cycle === 'annual') return `${symbol}${amount} / year`;
    return `${symbol}${amount} / month`;
  };

  const getPeriodText = (plan: PricingItem) => {
    if (plan.billing_cycle === 'one_time') return 'one-time payment';
    if (plan.billing_cycle === '28d') return 'every 28 days';
    if (plan.billing_cycle === 'annual') return 'per year';
    return 'per month';
  };

  // Partition pricing data
  const plans28d = pricing.filter(p => p.billing_cycle === '28d' && !p.isEarlyBird);
  const plansAnnual = pricing.filter(p => p.billing_cycle === 'annual' && !p.isEarlyBird);
  const earlyBirdAnnual = pricing.filter(p => p.billing_cycle === 'annual' && p.isEarlyBird);
  const lifetime = pricing.find(p => p.billing_cycle === 'one_time');

  // Replace annual plans with early bird if eligible
  const getAnnualPlans = () => {
    if (!flags.earlyBirdEligible) return plansAnnual;
    
    return plansAnnual.map(plan => {
      const ebPlan = earlyBirdAnnual.find(eb => eb.tier === plan.tier);
      return ebPlan || plan;
    });
  };

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

  const renderPlanCard = (plan: PricingItem, tabType: string) => {
    const isPro = plan.tier === 'pro';
    const isLifetime = plan.tier === 'lifetime';
    const isEssential = plan.tier === 'essential';
    const planKey = plan.price_id;

    return (
      <Card key={plan.id} className={`relative ${isEssential ? 'ring-2 ring-primary' : ''}`}>
        {isEssential && tabType === 'annual' && (
          <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
            Most Popular
          </Badge>
        )}
        {plan.isEarlyBird && (
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
          <CardTitle className="text-xl">{plan.tier.toUpperCase()}</CardTitle>
          <CardDescription className="text-sm">
            {plan.tier === 'essential' ? 'Essential fortune tracking' :
             plan.tier === 'growth' ? 'Enhanced tracking with extras' :
             plan.tier === 'pro' ? 'Advanced insights & support' :
             'All content forever'}
          </CardDescription>
          
          <div className="space-y-2">
            {plan.isEarlyBird && (
              <div className="text-sm text-muted-foreground">
                <span className="text-xs">Limited-time offer</span>
              </div>
            )}
            <div className="text-3xl font-bold text-primary">
              {formatPrice(plan)}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {getPeriodText(plan)}
              </span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {planFeatures[plan.tier as keyof typeof planFeatures]?.map((feature: string, index: number) => (
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
              onClick={() => handleCheckout(plan)}
              disabled={checkoutLoading[planKey]}
            >
              {checkoutLoading[planKey] ? 'Loading...' : 
               isLifetime ? 'Get Lifetime Access' : 'Get Started'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[85vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-background mx-4">
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Choose Your Plan</h1>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-8">
          {/* Early Bird Banner */}
          {flags.earlyBirdEligible && (
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Sparkles className="w-6 h-6 text-orange-500" />
                  <div>
                    <h3 className="font-semibold text-orange-900">Founders Offer</h3>
                    <p className="text-orange-700">
                      Save now before your free period ends! Get annual plans at special early-bird prices.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="text-center space-y-4">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading pricing plans...</p>
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={fetchPricing}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : pricing.length === 0 ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">No pricing plans available</p>
              <Button variant="outline" onClick={fetchPricing}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="annual" className="space-y-8">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                <TabsTrigger value="28d">Every 28 Days</TabsTrigger>
                <TabsTrigger value="annual">Annual</TabsTrigger>
              </TabsList>

              <TabsContent value="28d" className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  {plans28d.map(plan => renderPlanCard(plan, '28d'))}
                </div>
                
                {lifetime && (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-6">Or Go Lifetime</h3>
                    <div className="w-full max-w-md mx-auto">
                      {renderPlanCard(lifetime, 'lifetime')}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="annual" className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  {getAnnualPlans().map(plan => renderPlanCard(plan, 'annual'))}
                </div>
                
                {lifetime && (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-6">Or Go Lifetime</h3>
                    <div className="w-full max-w-md mx-auto">
                      {renderPlanCard(lifetime, 'lifetime')}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};