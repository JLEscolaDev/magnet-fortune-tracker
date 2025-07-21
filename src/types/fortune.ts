export interface Fortune {
  id: string;
  user_id: string;
  text: string;
  category: string; // Changed from FortuneCategory to string to match DB
  category_color?: string; // Color for custom categories
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
  display_name?: string;
  avatar_url?: string;
  level: number;
  total_fortunes: number;
  created_at: string;
  updated_at: string;
}

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