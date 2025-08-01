import React, { ReactNode } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PaywallGuard } from '@/components/paywall/PaywallGuard';

interface PaywallProps {
  children: ReactNode;
  feature?: string;
  onUpgrade?: () => void;
}

export const Paywall: React.FC<PaywallProps> = ({ children, feature, onUpgrade }) => {
  const { isActive } = useSubscription();
  
  // Check if running in native shell - don't show paywall for native apps
  const isNativeShell = import.meta.env.VITE_IS_NATIVE_SHELL === 'true';
  
  if (isNativeShell || isActive) {
    return <>{children}</>;
  }

  return (
    <PaywallGuard feature={feature} onUpgrade={onUpgrade}>
      {children}
    </PaywallGuard>
  );
};