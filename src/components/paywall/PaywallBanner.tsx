import React from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, X, Zap, TrendingUp } from 'lucide-react';
import { SUBSCRIPTION_LIMITS, PLAN_PRICES } from '@/config/limits';

interface PaywallBannerProps {
  currentUsage: number;
  limit: number;
  period: 'daily' | 'monthly';
  onUpgrade?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const PaywallBanner: React.FC<PaywallBannerProps> = ({
  currentUsage,
  limit,
  period,
  onUpgrade,
  onDismiss,
  className = ""
}) => {
  const { isActive } = useSubscription();

  // Don't show banner if user has active subscription
  if (isActive) {
    return null;
  }

  // Don't show banner if under limit
  if (currentUsage < limit) {
    return null;
  }

  const isAtLimit = currentUsage >= limit;
  const percentUsed = Math.min((currentUsage / limit) * 100, 100);
  
  return (
    <Card className={`border-warning/20 bg-gradient-to-r from-warning/10 to-accent/10 ${className}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-gradient-to-r from-warning to-accent p-1.5 rounded-full">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <h4 className="font-semibold text-foreground">
                {isAtLimit ? `${period.charAt(0).toUpperCase() + period.slice(1)} Limit Reached` : 'Approaching Limit'}
              </h4>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              You've used <strong>{currentUsage}</strong> of your <strong>{limit}</strong> {period} fortunes.
              {isAtLimit ? " Upgrade to Pro for unlimited access!" : " Upgrade to avoid interruptions."}
            </p>
            
            {/* Usage bar */}
            <div className="w-full bg-muted rounded-full h-2 mb-3">
              <div 
                className="bg-gradient-to-r from-warning to-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            
            {/* Features list */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Unlimited fortunes
              </div>
              <div className="flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Priority support
              </div>
            </div>
            
            <Button 
              onClick={onUpgrade}
              size="sm"
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro {PLAN_PRICES.PRO_MONTHLY}/month
            </Button>
          </div>
          
          {/* Dismiss button */}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground p-1 h-auto"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};