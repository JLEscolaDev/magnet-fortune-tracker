import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Crown, Sparkles, Lock, X, RefreshCw } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { callEdge } from '@/lib/edge-functions';
import { toast } from 'sonner';

interface PriceData {
  price_id: string;
  unit_amount: number;
  currency: string;
  type: string;
  interval: string | null;
  interval_count: number | null;
  product_name: string;
}

interface PlanWithPrice {
  id: string;
  name: string;
  price_id: string;
  level: number;
  billing_period: string;
  is_early_bird: boolean;
  tier: string;
  visibility?: 'visible' | 'hidden' | 'teaser';
  priceData?: PriceData;
}

interface PricingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PricingDialog: React.FC<PricingDialogProps> = ({ isOpen, onClose }) => {
  const { user, hasActiveSub, plansByCycle, plansLoading, isTrialActive, earlyBirdEligible, allPlans } = useSubscription();
  
  const [plans, setPlans] = useState<PlanWithPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('28d');

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Process plans and fetch pricing when modal opens
  useEffect(() => {
    if (isOpen && !plansLoading) {
      loadPricingData();
    }
  }, [isOpen, plansLoading, loadPricingData]);

  const loadPricingData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Combine all plans from plansByCycle
      const allPlans: PlanWithPrice[] = [
        ...plansByCycle['28d'].map(p => ({ ...p, tier: getTierFromName(p.name) })),
        ...plansByCycle.annual.map(p => ({ ...p, tier: getTierFromName(p.name) })),
        ...(plansByCycle.lifetime ? [{ ...plansByCycle.lifetime, tier: 'lifetime' }] : [])
      ];

      // Get unique price IDs
      const priceIds = [...new Set(allPlans.map(p => p.price_id))];

      // Fetch price data from Stripe
      const { data: priceData, error } = await callEdge('get-prices', { price_ids: priceIds }, false);
      
      if (error) throw new Error(error);

      // Map price data to plans
      const plansWithPrices = allPlans.map(plan => {
        const priceInfo = priceData?.find((p: PriceData) => p.price_id === plan.price_id);
        return {
          ...plan,
          priceData: priceInfo
        };
      });

      setPlans(plansWithPrices);
    } catch (error) {
      console.error('Error loading pricing data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load pricing');
    } finally {
      setLoading(false);
    }
  }, [plansByCycle]);

  const getTierFromName = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('essential')) return 'essential';
    if (lowerName.includes('growth')) return 'growth';
    if (lowerName.includes('pro')) return 'pro';
    return 'unknown';
  };

  const handleCheckout = async (plan: PlanWithPrice) => {
    if (!user) {
      toast.error('Please log in to subscribe');
      return;
    }

    const planKey = plan.price_id;
    setCheckoutLoading(prev => ({ ...prev, [planKey]: true }));

    try {
      const returnTo = window.location.pathname + window.location.search;
      const body = plan.is_early_bird 
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
        returnUrl: window.location.origin
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

  const formatPrice = (plan: PlanWithPrice, includeUnit = true) => {
    if (!plan.priceData) return 'Loading...';
    
    const amount = (plan.priceData.unit_amount / 100).toFixed(2);
    const symbol = plan.priceData.currency === 'eur' ? '€' : '$';
    
    if (plan.billing_period === 'lifetime') return `${symbol}${amount} one-time`;
    if (plan.billing_period === '28d') return `${symbol}${amount}`;
    if (plan.billing_period === 'annual') {
      return includeUnit ? `${symbol}${amount} / year` : `${symbol}${amount}`;
    }
    return `${symbol}${amount}`;
  };

  const getOriginalAnnualPrice = (ebPlan: PlanWithPrice) => {
    // Find the normal annual plan of the same tier
    const originalPlan = plans.find(p => 
      p.billing_period === 'annual' && 
      p.tier === ebPlan.tier && 
      !p.is_early_bird
    );
    return originalPlan ? formatPrice(originalPlan).replace(' / year', '') : null;
  };

  // Filter and organize plans for display
  const getPlansForTab = (tab: '28d' | 'annual') => {
    // First filter by visibility - exclude hidden plans
    interface PlanWithVisibility {
      billing_period: string;
      visibility?: 'visible' | 'hidden' | 'teaser';
      tier: string;
      is_early_bird: boolean;
    }

    const candidates = plans.filter((p): p is PlanWithVisibility => 
      p.billing_period === tab && 
      (p as PlanWithVisibility).visibility !== 'hidden'
    );

    if (tab === 'annual' && earlyBirdEligible) {
      // For each tier, prefer the EB variant if it exists
      const byTier = new Map<string, PlanWithVisibility>();
      for (const p of candidates) {
        const key = p.tier.toLowerCase();
        const existing = byTier.get(key);
        // prefer early-bird when eligible
        if (!existing) byTier.set(key, p);
        else if (!existing.is_early_bird && p.is_early_bird) byTier.set(key, p);
      }
      return Array.from(byTier.values());
    }

    // Monthly (28d): never show EB variants
    return candidates.filter(p => !p.is_early_bird);
  };

  interface PlanWithVisibility {
    billing_period: string;
    visibility?: 'visible' | 'hidden' | 'teaser';
  }

  const lifetimePlan = plans.find((p): p is PlanWithVisibility => p.billing_period === 'lifetime' && (p as PlanWithVisibility).visibility !== 'hidden');

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

  const renderPlanCard = (plan: PlanWithPrice, tabType: string) => {
    const isPro = plan.tier === 'pro';
    const isLifetime = plan.tier === 'lifetime';
    const isEssential = plan.tier === 'essential';
    const isGrowth = plan.tier === 'growth';
    const planKey = plan.price_id;
    const isTeaser = plan.visibility === 'teaser';

    // Check if Pro plan has price_id - if null, it's coming soon
    const isProComingSoon = isPro && !plan.price_id;

    return (
      <Card key={plan.id} className={`relative ${isEssential ? 'ring-2 ring-primary' : ''} ${isTeaser ? 'overflow-hidden' : ''}`}>
        {isTeaser && (
          <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center text-white p-6">
              <Lock className="w-12 h-12 mx-auto mb-3 text-white/80" />
              <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
              <p className="text-sm text-white/80">
                This plan will be available in the future. Stay tuned!
              </p>
            </div>
          </div>
        )}
        {isEssential && tabType === 'annual' && (
          <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
            Most Popular
          </Badge>
        )}
        {plan.is_early_bird && earlyBirdEligible && (
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
              {activeTab === 'annual' && earlyBirdEligible && plan.is_early_bird ? (
                <div className="space-y-1">
                  {getOriginalAnnualPrice(plan) && (
                    <div className="text-sm text-red-400 line-through text-center">
                      {getOriginalAnnualPrice(plan)} / year
                    </div>
                  )}
                  <div className="text-3xl font-extrabold text-emerald-400 text-center">
                    {formatPrice(plan).replace(' / year', '')}
                    <span className="text-base font-semibold text-emerald-300"> / year</span>
                  </div>
                </div>
              ) : (
                <div className="text-3xl font-extrabold text-primary text-center">
                  {formatPrice(plan)}
                </div>
              )}
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
          
          {isTeaser || isProComingSoon ? (
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
              disabled={checkoutLoading[planKey] || !plan.priceData}
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
          {earlyBirdEligible && activeTab === 'annual' && (
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

          {loading || plansLoading ? (
            <div className="text-center space-y-4">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading pricing plans...</p>
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={() => { setError(null); loadPricingData(); }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">No pricing plans available</p>
              <Button variant="outline" onClick={() => { setError(null); loadPricingData(); }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="28d" className="space-y-8" onValueChange={setActiveTab}>
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                <TabsTrigger value="28d">Recurrent</TabsTrigger>
                <TabsTrigger value="annual">Annual</TabsTrigger>
              </TabsList>

              {/* Explanatory text for recurrent plans */}
              {activeTab === '28d' && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground font-light">
                    Charged every 28 days
                  </p>
                </div>
              )}

              <TabsContent value="28d" className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  {getPlansForTab('28d').map(plan => renderPlanCard(plan, '28d'))}
                </div>
                
                {lifetimePlan && (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-6">Or Go Lifetime</h3>
                    <div className="w-full max-w-md mx-auto">
                      {renderPlanCard(lifetimePlan, 'lifetime')}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="annual" className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  {getPlansForTab('annual').map(plan => renderPlanCard(plan, 'annual'))}
                </div>
                
                {lifetimePlan && (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-6">Or Go Lifetime</h3>
                    <div className="w-full max-w-md mx-auto">
                      {renderPlanCard(lifetimePlan, 'lifetime')}
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
