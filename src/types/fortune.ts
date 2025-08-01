export interface Fortune {
  id: string;
  user_id: string;
  text: string;
  category: string; // Changed from FortuneCategory to string to match DB
  fortune_level?: number | null;
  fortune_value?: number | null;
  created_at: string;
}

export type FortuneCategory = 'Wealth' | 'Health' | 'Love' | 'Opportunity' | 'Other' | string;

export interface CategoryData {
  name: string;
  hasNumericValue: boolean;
  color: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  level?: number | null;
  total_fortunes?: number | null;
  created_at: string;
  updated_at: string;
  stripe_customer_id?: string | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type ActiveSubscription = Subscription;

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  state: 'locked' | 'earned';
  requiredCount: number;
  category?: FortuneCategory;
  progress?: number;
}