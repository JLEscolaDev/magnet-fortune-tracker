import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Crown, Sparkles, Lock, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { toast } from 'sonner';

interface PricingPageProps {
  onClose?: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onClose }) => {
  const { user, isActive, subscription } = useSubscription();
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [userFeatures, setUserFeatures] = useState<any>(null);
  const [earlyBirdDismissed, setEarlyBirdDismissed] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserFeatures();
    }
  }, [user]);

  const fetchUserFeatures = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_features_v')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setUserFeatures(data);
      setEarlyBirdDismissed(data?.early_bird_seen || false);
    } catch (error) {
      console.error('Error fetching user features:', error);
    }
  };

  const dismissEarlyBird = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ early_bird_seen: true })
        .eq('user_id', user.id);
      
      setEarlyBirdDismissed(true);
    } catch (error) {
      console.error('Error dismissing early bird:', error);
    }
  };

  const handleCheckout = async (plan: string) => {
    if (!user) {
      toast.error('Please log in to subscribe');
      return;
    }

    setLoading(prev => ({ ...prev, [plan]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan, returnUrl: window.location.origin + '/billing/success' }
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Error starting checkout. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, [plan]: false }));
    }
  };

  const handleManageBilling = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session');

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      toast.error('Error opening billing portal. Please try again.');
    }
  };

  const plans = {
    '28d': [
      {
        id: 'basic_28d',
        name: 'BASIC',
        price: '€6.45',
        period: 'every 28 days',
        description: 'Essential fortune tracking',
        features: [
          'Daily fortune tracking',
          'Simple charts & statistics',
          'Achievement system',
          'Settings & preferences'
        ],
        popular: false,
        available: true
      },
      {
        id: 'growth_28d',
        name: 'GROWTH',
        price: '€11.90',
        period: 'every 28 days',
        description: 'Enhanced tracking with extras',
        features: [
          'Everything in BASIC',
          'Expanded charts & analytics',
          'Photo uploads per fortune',
          'Calendar review',
          'Backfill previous days'
        ],
        popular: false,
        available: true,
        decoy: true
      },
      {
        id: 'pro_28d',
        name: 'PRO',
        price: '€19.90',
        period: 'every 28 days',
        description: 'Advanced insights & support',
        features: [
          'Everything in GROWTH',
          'Health/mood tracking',
          'Pattern insights',
          'Decision timing advice',
          'Priority support'
        ],
        popular: false,
        available: false,
        locked: true
      }
    ],
    annual: [
      {
        id: 'basic_annual',
        name: 'BASIC',
        price: '€69',
        period: 'per year',
        description: 'Essential fortune tracking',
        features: [
          'Daily fortune tracking',
          'Simple charts & statistics',
          'Achievement system',
          'Settings & preferences'
        ],
        popular: true,
        available: true,
        earlyBirdPrice: '€49',
        earlyBirdId: 'basic_annual_eb'
      },
      {
        id: 'growth_annual',
        name: 'GROWTH',
        price: '€119',
        period: 'per year',
        description: 'Enhanced tracking with extras',
        features: [
          'Everything in BASIC',
          'Expanded charts & analytics',
          'Photo uploads per fortune',
          'Calendar review',
          'Backfill previous days'
        ],
        popular: false,
        available: true,
        decoy: true,
        earlyBirdPrice: '€89',
        earlyBirdId: 'growth_annual_eb'
      },
      {
        id: 'pro_annual',
        name: 'PRO',
        price: '€199',
        period: 'per year',
        description: 'Advanced insights & support',
        features: [
          'Everything in GROWTH',
          'Health/mood tracking',
          'Pattern insights',
          'Decision timing advice',
          'Priority support'
        ],
        popular: false,
        available: false,
        locked: true
      }
    ]
  };

  const lifetimePlan = {
    id: 'lifetime_oneoff',
    name: 'LIFETIME',
    price: '€1,790',
    period: 'one-time payment',
    description: 'All content forever',
    features: [
      'Everything included',
      'Lifetime access',
      'All future features',
      'Priority support',
      'No recurring payments'
    ],
    popular: false,
    available: true
  };

  const showEarlyBird = userFeatures?.is_trial_active && !userFeatures?.early_bird_redeemed && !earlyBirdDismissed;

  const renderPlanCard = (plan: any, tabType: string) => {
    const isEarlyBird = showEarlyBird && plan.earlyBirdPrice && tabType === 'annual';
    const currentPrice = isEarlyBird ? plan.earlyBirdPrice : plan.price;
    const planId = isEarlyBird ? plan.earlyBirdId : plan.id;

    return (
      <Card key={plan.id} className={`relative ${plan.popular ? 'ring-2 ring-primary' : ''} ${plan.decoy ? 'opacity-90' : ''}`}>
        {plan.popular && (
          <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
            Most Popular
          </Badge>
        )}
        {plan.decoy && (
          <Badge variant="outline" className="absolute -top-2 right-2 text-xs">
            Good, but not our best value
          </Badge>
        )}
        {isEarlyBird && (
          <Badge className="absolute -top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <Sparkles className="w-3 h-3 mr-1" />
            Early Bird
          </Badge>
        )}
        
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{plan.name}</CardTitle>
          <CardDescription className="text-sm">{plan.description}</CardDescription>
          
          <div className="space-y-2">
            {isEarlyBird && (
              <div className="text-sm text-muted-foreground line-through">
                {plan.price}
              </div>
            )}
            <div className="text-3xl font-bold text-primary">
              {currentPrice}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {plan.period}
              </span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {plan.features.map((feature: string, index: number) => (
              <li key={index} className="flex items-center text-sm">
                <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          
          {plan.locked ? (
            <Button disabled className="w-full">
              <Lock className="w-4 h-4 mr-2" />
              Coming Soon
            </Button>
          ) : isActive ? (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleManageBilling}
            >
              Manage Billing
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => handleCheckout(planId)}
              disabled={loading[planId]}
            >
              {loading[planId] ? 'Loading...' : 'Get Started'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderLifetimeCard = () => (
    <Card className="w-full max-w-md mx-auto relative">
      <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
        <Crown className="w-3 h-3 mr-1" />
        Ultimate Value
      </Badge>
      
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{lifetimePlan.name}</CardTitle>
        <CardDescription className="text-sm">{lifetimePlan.description}</CardDescription>
        
        <div className="text-3xl font-bold text-primary">
          {lifetimePlan.price}
          <span className="text-sm font-normal text-muted-foreground ml-1">
            {lifetimePlan.period}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {lifetimePlan.features.map((feature, index) => (
            <li key={index} className="flex items-center text-sm">
              <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
        
        {isActive ? (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleManageBilling}
          >
            Manage Billing
          </Button>
        ) : (
          <Button
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            onClick={() => handleCheckout(lifetimePlan.id)}
            disabled={loading[lifetimePlan.id]}
          >
            {loading[lifetimePlan.id] ? 'Loading...' : 'Get Lifetime Access'}
          </Button>
        )}
      </CardContent>
    </Card>
  );

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
              {plans['28d'].map(plan => renderPlanCard(plan, '28d'))}
            </div>
            
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-6">Or Go Lifetime</h3>
              {renderLifetimeCard()}
            </div>
          </TabsContent>

          <TabsContent value="annual" className="space-y-8">
            <div className="grid md:grid-cols-3 gap-6">
              {plans.annual.map(plan => renderPlanCard(plan, 'annual'))}
            </div>
            
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-6">Or Go Lifetime</h3>
              {renderLifetimeCard()}
            </div>
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