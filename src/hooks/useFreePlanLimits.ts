import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getFortunesCount, getFortunesForDateRange } from '@/lib/fortunes';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_LIMITS } from '@/config/limits';

interface FreePlanStatus {
  isWithinTrialPeriod: boolean;
  totalFortunes: number;
  daysSinceSignup: number;
  hasFullAccess: boolean;
  isRestricted: boolean;
  dailyFortunesAdded: number;
  canAddFortune: boolean;
  restrictionReason: 'trial_expired' | 'fortune_limit_reached' | 'daily_limit_reached' | null;
  loading: boolean;
  restrictionMessage: string | null;
}

export const useFreePlanLimits = (): FreePlanStatus => {
  const { isActive, loading: subscriptionLoading } = useSubscription();
  const [status, setStatus] = useState<FreePlanStatus>({
    isWithinTrialPeriod: true,
    totalFortunes: 0,
    daysSinceSignup: 0,
    hasFullAccess: true,
    isRestricted: false,
    dailyFortunesAdded: 0,
    canAddFortune: true,
    restrictionReason: null,
    restrictionMessage: null,
    loading: true,
  });

  useEffect(() => {
    const checkFreePlanLimits = async () => {
      if (subscriptionLoading) return;
      
      // If user has active subscription, they have full access
      if (isActive) {
        setStatus(prev => ({
          ...prev,
          hasFullAccess: true,
          isRestricted: false,
          canAddFortune: true,
          restrictionReason: null,
          restrictionMessage: null,
          loading: false,
        }));
        return;
      }

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          setStatus(prev => ({ ...prev, loading: false }));
          return;
        }

        // Get user profile to check signup date
        const { data: profile } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('user_id', user.id)
          .single();

        // Calculate days since signup
        const signupDate = new Date(profile?.created_at || user.created_at);
        const daysSinceSignup = Math.floor((Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
        const isWithinTrialPeriod = daysSinceSignup < SUBSCRIPTION_LIMITS.FREE_TRIAL_DAYS;

        // Get total fortunes count
        const totalFortunes = await getFortunesCount(user.id);

        // Get today's fortunes count
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const todayFortunes = await getFortunesForDateRange(
          user.id,
          startOfDay.toISOString(),
          endOfDay.toISOString()
        );
        const dailyFortunesAdded = todayFortunes.length;

        // Determine if user has full access
        const hasFullAccess = isWithinTrialPeriod && (totalFortunes || 0) < SUBSCRIPTION_LIMITS.FREE_TRIAL_FORTUNE_LIMIT;
        
        // Determine restriction reason and message
        let restrictionReason: FreePlanStatus['restrictionReason'] = null;
        let restrictionMessage: string | null = null;
        let canAddFortune = true;

        if (!hasFullAccess) {
          if (!isWithinTrialPeriod) {
            restrictionReason = 'trial_expired';
            restrictionMessage = `Your ${SUBSCRIPTION_LIMITS.FREE_TRIAL_DAYS}-day trial has ended.`;
          } else if ((totalFortunes || 0) >= SUBSCRIPTION_LIMITS.FREE_TRIAL_FORTUNE_LIMIT) {
            restrictionReason = 'fortune_limit_reached';
            restrictionMessage = `You've reached ${SUBSCRIPTION_LIMITS.FREE_TRIAL_FORTUNE_LIMIT} fortunes.`;
          }

          // Check daily limit for restricted users
          if ((dailyFortunesAdded || 0) >= SUBSCRIPTION_LIMITS.FREE_RESTRICTED_DAILY_LIMIT) {
            restrictionReason = 'daily_limit_reached';
            restrictionMessage = 'Your free plan now limits you to 1 fortune per day.';
            canAddFortune = false;
          } else if (restrictionMessage) {
            restrictionMessage += ` You can add ${SUBSCRIPTION_LIMITS.FREE_RESTRICTED_DAILY_LIMIT} fortune per day.`;
          }
        }

        const newStatus = {
          isWithinTrialPeriod,
          totalFortunes: totalFortunes || 0,
          daysSinceSignup,
          hasFullAccess,
          isRestricted: !hasFullAccess,
          dailyFortunesAdded: dailyFortunesAdded || 0,
          canAddFortune,
          restrictionReason,
          restrictionMessage,
          loading: false,
        };

        console.log('[FREE_PLAN_LIMITS] Debug info:', {
          signupDate,
          daysSinceSignup,
          isWithinTrialPeriod,
          totalFortunes,
          dailyFortunesAdded,
          hasFullAccess,
          canAddFortune,
          restrictionReason,
          restrictionMessage,
          isActive,
          SUBSCRIPTION_LIMITS
        });

        setStatus(newStatus);

      } catch (error) {
        console.error('Error checking free plan limits:', error);
        setStatus(prev => ({ ...prev, loading: false }));
      }
    };

    checkFreePlanLimits();
  }, [isActive, subscriptionLoading]);

  return status;
};