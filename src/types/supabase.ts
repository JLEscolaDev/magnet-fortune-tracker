export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      fortunes: {
        Row: {
          id: string;
          text: string;
          category: string;
          fortune_level: number;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          text: string;
          category: string;
          fortune_level?: number;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['fortunes']['Row']>;
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          avatar_url: string;
          level: number;
          total_fortunes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>;
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };

      reflections: {
        Row: {
          id: string;
          text: string;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          text: string;
          date: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reflections']['Row']>;
        Relationships: [];
      };

      custom_categories: {
        Row: {
          id: string;
          name: string;
          has_numeric_value: boolean;
          color: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          has_numeric_value: boolean;
          color: string;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['custom_categories']['Row']>;
        Relationships: [];
      };
    };

    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};