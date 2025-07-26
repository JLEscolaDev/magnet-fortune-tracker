export const SUBSCRIPTION_LIMITS = {
  // Free plan conditions
  FREE_TRIAL_DAYS: 60,
  FREE_TRIAL_FORTUNE_LIMIT: 100,
  FREE_RESTRICTED_DAILY_LIMIT: 1,
  
  // Legacy limits (kept for compatibility)
  FREE_DAILY_LIMIT: 5,
  FREE_MONTHLY_LIMIT: 50,
  FREE_CATEGORIES_LIMIT: 3,
  PRO_DAILY_LIMIT: 100,
  PRO_MONTHLY_LIMIT: 1000,
  PRO_CATEGORIES_LIMIT: 20,
} as const;

export const PLAN_NAMES = {
  FREE: 'Free',
  PRO: 'Pro',
  PREMIUM: 'Premium',
} as const;

export const PLAN_PRICES = {
  PRO_MONTHLY: '$9.99',
  PRO_YEARLY: '$99.99',
  PREMIUM_MONTHLY: '$19.99',
  PREMIUM_YEARLY: '$199.99',
} as const;