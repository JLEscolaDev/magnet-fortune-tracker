export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      app_secrets: {
        Row: {
          created_at: string | null
          key: string
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          value?: string
        }
        Relationships: []
      }
      avatars: {
        Row: {
          created_at: string
          id: string
          level: number
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: number
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      custom_categories: {
        Row: {
          color: string
          has_numeric_value: boolean
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color: string
          has_numeric_value?: boolean
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          has_numeric_value?: boolean
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      fortunes: {
        Row: {
          category: string
          created_at: string
          enc_ver: number | null
          fortune_level: number | null
          fortune_value: number | null
          id: string
          impact_level: Database["public"]["Enums"]["fortune_impact_level"]
          text: string
          text_iv: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          enc_ver?: number | null
          fortune_level?: number | null
          fortune_value?: number | null
          id?: string
          impact_level?: Database["public"]["Enums"]["fortune_impact_level"]
          text: string
          text_iv?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          enc_ver?: number | null
          fortune_level?: number | null
          fortune_value?: number | null
          id?: string
          impact_level?: Database["public"]["Enums"]["fortune_impact_level"]
          text?: string
          text_iv?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fortunes_backup_20250824: {
        Row: {
          category: string | null
          created_at: string | null
          enc_ver: number | null
          fortune_level: number | null
          fortune_value: number | null
          id: string | null
          text: string | null
          text_iv: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          enc_ver?: number | null
          fortune_level?: number | null
          fortune_value?: number | null
          id?: string | null
          text?: string | null
          text_iv?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          enc_ver?: number | null
          fortune_level?: number | null
          fortune_value?: number | null
          id?: string | null
          text?: string | null
          text_iv?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_period: string | null
          created_at: string | null
          id: string
          is_early_bird: boolean | null
          level: number
          name: string
          price_id: string
          visibility: Database["public"]["Enums"]["Visibility"]
        }
        Insert: {
          billing_period?: string | null
          created_at?: string | null
          id?: string
          is_early_bird?: boolean | null
          level: number
          name: string
          price_id: string
          visibility?: Database["public"]["Enums"]["Visibility"]
        }
        Update: {
          billing_period?: string | null
          created_at?: string | null
          id?: string
          is_early_bird?: boolean | null
          level?: number
          name?: string
          price_id?: string
          visibility?: Database["public"]["Enums"]["Visibility"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          early_bird_redeemed: boolean | null
          early_bird_seen: boolean | null
          level: number | null
          stripe_customer_id: string | null
          total_fortunes: number | null
          trial_ends_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          early_bird_redeemed?: boolean | null
          early_bird_seen?: boolean | null
          level?: number | null
          stripe_customer_id?: string | null
          total_fortunes?: number | null
          trial_ends_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          early_bird_redeemed?: boolean | null
          early_bird_seen?: boolean | null
          level?: number | null
          stripe_customer_id?: string | null
          total_fortunes?: number | null
          trial_ends_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quotes_master: {
        Row: {
          author: string | null
          created_at: string
          id: string
          source: string | null
          tags: string[] | null
          text_en: string
          text_es: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          source?: string | null
          tags?: string[] | null
          text_en: string
          text_es?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          source?: string | null
          tags?: string[] | null
          text_en?: string
          text_es?: string | null
        }
        Relationships: []
      }
      reflections: {
        Row: {
          created_at: string
          date: string | null
          id: string
          text: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          id?: string
          text?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          id?: string
          text?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          is_lifetime: boolean | null
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          is_lifetime?: boolean | null
          plan_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          is_lifetime?: boolean | null
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      available_plans_v: {
        Row: {
          billing_period: string | null
          is_early_bird: boolean | null
          level: number | null
          name: string | null
          price_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          level: number | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          level?: number | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          level?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_features: {
        Row: {
          created_at: string | null
          early_bird_eligible: boolean | null
          early_bird_redeemed: boolean | null
          early_bird_seen: boolean | null
          is_trial_active: boolean | null
          trial_ends_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          early_bird_eligible?: never
          early_bird_redeemed?: never
          early_bird_seen?: never
          is_trial_active?: never
          trial_ends_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          early_bird_eligible?: never
          early_bird_redeemed?: never
          early_bird_seen?: never
          is_trial_active?: never
          trial_ends_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _detect_fortune_cipher: {
        Args: Record<PropertyKey, never>
        Returns: {
          key_source: string
          ok: boolean
          sample: string
        }[]
      }
      _enc_key_for: {
        Args: { uid: string }
        Returns: string
      }
      _recrypt_legacy_to_appkey: {
        Args: { batch_size?: number }
        Returns: number
      }
      derive_passphrase: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      derive_passphrase_for: {
        Args: { _uid: string }
        Returns: string
      }
      encrypt_with_app_key: {
        Args: { plain: string }
        Returns: string
      }
      fortune_add: {
        Args:
          | {
              p_category?: string
              p_created_at?: string
              p_impact_level?: Database["public"]["Enums"]["fortune_impact_level"]
              p_level?: number
              p_text: string
            }
          | {
              p_category?: string
              p_created_at?: string
              p_level?: number
              p_text: string
            }
          | { p_category?: string; p_level?: number; p_text: string }
        Returns: string
      }
      fortune_counts: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      fortune_decrypt: {
        Args: { _id: string }
        Returns: {
          category: string
          created_at: string
          fortune_level: number
          id: string
          text: string
        }[]
      }
      fortune_delete: {
        Args: { p_id: string }
        Returns: undefined
      }
      fortune_get: {
        Args: { _id: string }
        Returns: {
          category: string
          created_at: string
          fortune_level: number
          id: string
          text: string
        }[]
      }
      fortune_list: {
        Args: Record<PropertyKey, never> | { p_from: string; p_to: string }
        Returns: {
          category: string
          created_at: string
          fortune_level: number
          id: string
          text: string
          user_id: string
        }[]
      }
      fortune_put: {
        Args: {
          p_category: string
          p_created_at?: string
          p_fortune_value: number
          p_text: string
        }
        Returns: Json
      }
      fortune_update: {
        Args: {
          p_category?: string
          p_id: string
          p_level?: number
          p_text: string
        }
        Returns: undefined
      }
      get_app_enc_key: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_private_enc_salt: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_trial_active: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      try_base64_text: {
        Args: { s: string }
        Returns: string
      }
      try_decrypt_auto: {
        Args: { _uid: string; armor: string }
        Returns: string
      }
      try_decrypt_maybe_base64: {
        Args: { armor: string }
        Returns: string
      }
      try_decrypt_with_derived: {
        Args: { _uid: string; armor: string }
        Returns: string
      }
      try_decrypt_with_key: {
        Args: { armor: string; k: string }
        Returns: string
      }
      try_decrypt_with_user_salt: {
        Args: { _uid: string; armor: string; salt: string }
        Returns: string
      }
      try_double_decrypt: {
        Args: { armor: string; k_inner: string; k_outer: string }
        Returns: string
      }
    }
    Enums: {
      fortune_impact_level: "small_step" | "milestone" | "big_win"
      Visibility: "hidden" | "teaser" | "visible"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      fortune_impact_level: ["small_step", "milestone", "big_win"],
      Visibility: ["hidden", "teaser", "visible"],
    },
  },
} as const
