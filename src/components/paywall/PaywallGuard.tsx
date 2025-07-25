import React, { ReactNode } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Sparkles } from 'lucide-react';

interface PaywallGuardProps {
  children: ReactNode;
  feature?: string;
  className?: string;
  showCTA?: boolean;
  onUpgrade?: () => void;
}

export const PaywallGuard: React.FC<PaywallGuardProps> = ({ 
  children, 
  feature = "this feature",
  className = "",
  showCTA = true,
  onUpgrade
}) => {
  const { isActive, loading } = useSubscription();

  // Show children normally if user has active subscription or still loading
  if (loading || isActive) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Blurred content */}
      <div className="blur-sm pointer-events-none select-none opacity-60">
        {children}
      </div>
      
      {/* Overlay with CTA */}
      {showCTA && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Card className="bg-background/95 backdrop-blur-sm border-primary/20 shadow-xl max-w-sm mx-4">
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-gradient-to-r from-primary to-accent p-3 rounded-full">
                  <Crown className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              
              <h3 className="font-semibold text-lg mb-2 text-foreground">
                Unlock {feature}
              </h3>
              
              <p className="text-muted-foreground text-sm mb-4">
                Upgrade to Pro to access all premium features and unlimited usage.
              </p>
              
              <Button 
                onClick={onUpgrade}
                className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-medium"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};