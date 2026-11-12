export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_role: string | null;
          actor_user_id: string | null;
          created_at: string;
          detail: NonNullable<Json>;
          entity_id: string | null;
          entity_type: string;
          id: string;
          restaurant_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_role?: string | null;
          actor_user_id?: string | null;
          created_at?: string;
          detail?: NonNullable<Json>;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          restaurant_id?: string | null;
        };
        Update: {
          action?: string;
          actor_role?: string | null;
          actor_user_id?: string | null;
          created_at?: string;
          detail?: NonNullable<Json>;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          restaurant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      guest_sessions: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          last_seen_at: string;
          restaurant_id: string;
          table_session_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          last_seen_at?: string;
          restaurant_id: string;
          table_session_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          last_seen_at?: string;
          restaurant_id?: string;
          table_session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guest_sessions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guest_sessions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guest_sessions_table_session_fk";
            columns: ["table_session_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id", "restaurant_id"];
          },
          {
            foreignKeyName: "guest_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          restaurant_id: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          restaurant_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          restaurant_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          category_id: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_available: boolean;
          name: string;
          price_tzs: number;
          restaurant_id: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          name: string;
          price_tzs: number;
          restaurant_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          name?: string;
          price_tzs?: number;
          restaurant_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_category_fk";
            columns: ["category_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id", "restaurant_id"];
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_events: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          event_type: Database["public"]["Enums"]["order_event_type"];
          from_status: Database["public"]["Enums"]["order_status"] | null;
          id: string;
          note: string | null;
          order_id: string;
          restaurant_id: string;
          to_status: Database["public"]["Enums"]["order_status"] | null;
        };
        ComputedFields: never;
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          event_type: Database["public"]["Enums"]["order_event_type"];
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: string;
          note?: string | null;
          order_id: string;
          restaurant_id: string;
          to_status?: Database["public"]["Enums"]["order_status"] | null;
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          event_type?: Database["public"]["Enums"]["order_event_type"];
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: string;
          note?: string | null;
          order_id?: string;
          restaurant_id?: string;
          to_status?: Database["public"]["Enums"]["order_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_events_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_events_order_fk";
            columns: ["order_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          menu_item_id: string | null;
          name_snapshot: string;
          notes: string | null;
          options: NonNullable<Json>;
          order_id: string;
          quantity: number;
          restaurant_id: string;
          subtotal_tzs: number | null;
          unit_price_tzs: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          menu_item_id?: string | null;
          name_snapshot: string;
          notes?: string | null;
          options?: NonNullable<Json>;
          order_id: string;
          quantity: number;
          restaurant_id: string;
          subtotal_tzs?: never;
          unit_price_tzs: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          menu_item_id?: string | null;
          name_snapshot?: string;
          notes?: string | null;
          options?: NonNullable<Json>;
          order_id?: string;
          quantity?: number;
          restaurant_id?: string;
          subtotal_tzs?: never;
          unit_price_tzs?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_fk";
            columns: ["order_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          guest_session_id: string;
          id: string;
          notes: string | null;
          order_number: number;
          placed_at: string;
          placed_by: string | null;
          restaurant_id: string;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_tzs: number;
          table_session_id: string;
          total_tzs: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          guest_session_id: string;
          id?: string;
          notes?: string | null;
          order_number?: never;
          placed_at?: string;
          placed_by?: string | null;
          restaurant_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_tzs?: number;
          table_session_id: string;
          total_tzs?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          guest_session_id?: string;
          id?: string;
          notes?: string | null;
          order_number?: never;
          placed_at?: string;
          placed_by?: string | null;
          restaurant_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_tzs?: number;
          table_session_id?: string;
          total_tzs?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_guest_session_fk";
            columns: ["guest_session_id", "table_session_id"];
            isOneToOne: false;
            referencedRelation: "guest_sessions";
            referencedColumns: ["id", "table_session_id"];
          },
          {
            foreignKeyName: "orders_placed_by_fkey";
            columns: ["placed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_table_session_fk";
            columns: ["table_session_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
      payment_attempts: {
        Row: {
          amount_tzs: number;
          created_at: string;
          currency: string;
          error_code: string | null;
          error_message: string | null;
          id: string;
          payment_id: string;
          provider_reference: string | null;
          provider_status: string | null;
          restaurant_id: string;
          status: Database["public"]["Enums"]["payment_attempt_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_tzs: number;
          created_at?: string;
          currency?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          payment_id: string;
          provider_reference?: string | null;
          provider_status?: string | null;
          restaurant_id: string;
          status?: Database["public"]["Enums"]["payment_attempt_status"];
          updated_at?: string;
        };
        Update: {
          amount_tzs?: number;
          created_at?: string;
          currency?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          payment_id?: string;
          provider_reference?: string | null;
          provider_status?: string | null;
          restaurant_id?: string;
          status?: Database["public"]["Enums"]["payment_attempt_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_attempts_payment_fk";
            columns: ["payment_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
      payment_webhook_events: {
        Row: {
          created_at: string;
          error_message: string | null;
          event_id: string;
          id: string;
          payload: NonNullable<Json>;
          payment_id: string | null;
          processed_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          received_at: string;
          restaurant_id: string | null;
          signature_verified: boolean;
          status: Database["public"]["Enums"]["payment_webhook_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          error_message?: string | null;
          event_id: string;
          id?: string;
          payload?: NonNullable<Json>;
          payment_id?: string | null;
          processed_at?: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          received_at?: string;
          restaurant_id?: string | null;
          signature_verified?: boolean;
          status?: Database["public"]["Enums"]["payment_webhook_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          event_id?: string;
          id?: string;
          payload?: NonNullable<Json>;
          payment_id?: string | null;
          processed_at?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          received_at?: string;
          restaurant_id?: string | null;
          signature_verified?: boolean;
          status?: Database["public"]["Enums"]["payment_webhook_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_webhook_events_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_webhook_events_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_tzs: number;
          created_at: string;
          currency: string;
          failure_reason: string | null;
          id: string;
          paid_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_checkout_url: string | null;
          provider_reference: string | null;
          restaurant_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          table_session_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_tzs: number;
          created_at?: string;
          currency?: string;
          failure_reason?: string | null;
          id?: string;
          paid_at?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_checkout_url?: string | null;
          provider_reference?: string | null;
          restaurant_id: string;
          status?: Database["public"]["Enums"]["payment_status"];
          table_session_id: string;
          updated_at?: string;
        };
        Update: {
          amount_tzs?: number;
          created_at?: string;
          currency?: string;
          failure_reason?: string | null;
          id?: string;
          paid_at?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_checkout_url?: string | null;
          provider_reference?: string | null;
          restaurant_id?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          table_session_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_table_session_fk";
            columns: ["table_session_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          granted_by: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_admins_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      restaurant_applications: {
        Row: {
          applicant_name: string | null;
          applicant_phone: string | null;
          applicant_user_id: string;
          created_at: string;
          id: string;
          message: string | null;
          rejection_reason: string | null;
          restaurant_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          applicant_name?: string | null;
          applicant_phone?: string | null;
          applicant_user_id: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          rejection_reason?: string | null;
          restaurant_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
        };
        Update: {
          applicant_name?: string | null;
          applicant_phone?: string | null;
          applicant_user_id?: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          rejection_reason?: string | null;
          restaurant_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_applications_applicant_user_id_fkey";
            columns: ["applicant_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_applications_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_applications_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_applications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_members: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string | null;
          is_active: boolean;
          restaurant_id: string;
          role: Database["public"]["Enums"]["restaurant_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          is_active?: boolean;
          restaurant_id: string;
          role: Database["public"]["Enums"]["restaurant_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          is_active?: boolean;
          restaurant_id?: string;
          role?: Database["public"]["Enums"]["restaurant_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_members_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_staff_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_user_id: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          restaurant_id: string;
          role: Database["public"]["Enums"]["restaurant_role"];
          status: Database["public"]["Enums"]["staff_invitation_status"];
          token_hash: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          restaurant_id: string;
          role: Database["public"]["Enums"]["restaurant_role"];
          status?: Database["public"]["Enums"]["staff_invitation_status"];
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          restaurant_id?: string;
          role?: Database["public"]["Enums"]["restaurant_role"];
          status?: Database["public"]["Enums"]["staff_invitation_status"];
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_invitations_accepted_user_id_fkey";
            columns: ["accepted_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_staff_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_staff_invitations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_staff_invitations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_subscriptions: {
        Row: {
          cancelled_at: string | null;
          created_at: string;
          expires_on: string | null;
          id: string;
          plan_id: string;
          renews_on: string | null;
          restaurant_id: string;
          starts_on: string;
          status: Database["public"]["Enums"]["subscription_status"];
          table_limit: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cancelled_at?: string | null;
          created_at?: string;
          expires_on?: string | null;
          id?: string;
          plan_id: string;
          renews_on?: string | null;
          restaurant_id: string;
          starts_on?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          table_limit: number;
          updated_at?: string;
        };
        Update: {
          cancelled_at?: string | null;
          created_at?: string;
          expires_on?: string | null;
          id?: string;
          plan_id?: string;
          renews_on?: string | null;
          restaurant_id?: string;
          starts_on?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          table_limit?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_subscriptions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_subscriptions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_tables: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          qr_token: string;
          restaurant_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          qr_token?: string;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          qr_token?: string;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurants: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          application_status: Database["public"]["Enums"]["application_status"];
          approved_at: string | null;
          approved_by: string | null;
          city: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          country_code: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          operational_status: Database["public"]["Enums"]["operational_status"];
          region: string | null;
          slug: string;
          subscription_status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          application_status?: Database["public"]["Enums"]["application_status"];
          approved_at?: string | null;
          approved_by?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          operational_status?: Database["public"]["Enums"]["operational_status"];
          region?: string | null;
          slug: string;
          subscription_status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          application_status?: Database["public"]["Enums"]["application_status"];
          approved_at?: string | null;
          approved_by?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          operational_status?: Database["public"]["Enums"]["operational_status"];
          region?: string | null;
          slug?: string;
          subscription_status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurants_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurants_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_payments: {
        Row: {
          amount_tzs: number;
          created_at: string;
          currency: string;
          failure_reason: string | null;
          id: string;
          paid_at: string | null;
          period_ends_on: string | null;
          period_starts_on: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_checkout_url: string | null;
          provider_reference: string | null;
          restaurant_id: string;
          restaurant_subscription_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_tzs: number;
          created_at?: string;
          currency?: string;
          failure_reason?: string | null;
          id?: string;
          paid_at?: string | null;
          period_ends_on?: string | null;
          period_starts_on?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_checkout_url?: string | null;
          provider_reference?: string | null;
          restaurant_id: string;
          restaurant_subscription_id: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_tzs?: number;
          created_at?: string;
          currency?: string;
          failure_reason?: string | null;
          id?: string;
          paid_at?: string | null;
          period_ends_on?: string | null;
          period_starts_on?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_checkout_url?: string | null;
          provider_reference?: string | null;
          restaurant_id?: string;
          restaurant_subscription_id?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_payments_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_subscription_fk";
            columns: ["restaurant_subscription_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_subscriptions";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          price_tzs: number;
          table_limit: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          price_tzs: number;
          table_limit: number;
          updated_at?: string;
        };
        Update: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_tzs?: number;
          table_limit?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      table_sessions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          id: string;
          party_size: number | null;
          requested_at: string;
          restaurant_id: string;
          status: Database["public"]["Enums"]["table_session_status"];
          table_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          id?: string;
          party_size?: number | null;
          requested_at?: string;
          restaurant_id: string;
          status?: Database["public"]["Enums"]["table_session_status"];
          table_id: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          id?: string;
          party_size?: number | null;
          requested_at?: string;
          restaurant_id?: string;
          status?: Database["public"]["Enums"]["table_session_status"];
          table_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "table_sessions_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_sessions_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "public_restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_sessions_table_fk";
            columns: ["table_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_tables";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
      waiter_requests: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          created_at: string;
          guest_session_id: string | null;
          id: string;
          note: string | null;
          request_type: Database["public"]["Enums"]["waiter_request_type"];
          resolved_at: string | null;
          resolved_by: string | null;
          restaurant_id: string;
          status: Database["public"]["Enums"]["waiter_request_status"];
          table_session_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          guest_session_id?: string | null;
          id?: string;
          note?: string | null;
          request_type?: Database["public"]["Enums"]["waiter_request_type"];
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id: string;
          status?: Database["public"]["Enums"]["waiter_request_status"];
          table_session_id: string;
          updated_at?: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          guest_session_id?: string | null;
          id?: string;
          note?: string | null;
          request_type?: Database["public"]["Enums"]["waiter_request_type"];
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id?: string;
          status?: Database["public"]["Enums"]["waiter_request_status"];
          table_session_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waiter_requests_acknowledged_by_fkey";
            columns: ["acknowledged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waiter_requests_guest_session_id_fkey";
            columns: ["guest_session_id"];
            isOneToOne: false;
            referencedRelation: "guest_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waiter_requests_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waiter_requests_table_session_fk";
            columns: ["table_session_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
    };
    Views: {
      public_restaurants: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          contact_phone: string | null;
          country_code: string;
          description: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          region: string | null;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          contact_phone?: string | null;
          country_code?: string | null;
          description?: string | null;
          id?: string | null;
          logo_url?: string | null;
          name?: string | null;
          region?: string | null;
          slug?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          contact_phone?: string | null;
          country_code?: string | null;
          description?: string | null;
          id?: string | null;
          logo_url?: string | null;
          name?: string | null;
          region?: string | null;
          slug?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_restaurant_invitation: {
        Args: { p_token: string };
        Returns: {
          restaurant_id: string;
          restaurant_name: string;
          restaurant_slug: string;
          role: Database["public"]["Enums"]["restaurant_role"];
        }[];
      };
      apply_for_restaurant: {
        Args: {
          p_address_line1?: string;
          p_address_line2?: string;
          p_city?: string;
          p_contact_email?: string;
          p_contact_phone?: string;
          p_description?: string;
          p_message?: string;
          p_name: string;
          p_region?: string;
          p_slug: string;
        };
        Returns: {
          applicant_name: string | null;
          applicant_phone: string | null;
          applicant_user_id: string;
          created_at: string;
          id: string;
          message: string | null;
          rejection_reason: string | null;
          restaurant_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "restaurant_applications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      approve_table_session: {
        Args: { p_session_id: string };
        Returns: {
          approved_at: string | null;
          approved_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          id: string;
          party_size: number | null;
          requested_at: string;
          restaurant_id: string;
          status: Database["public"]["Enums"]["table_session_status"];
          table_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "table_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      can_read_order: { Args: { p_order_id: string; p_restaurant_id: string }; Returns: boolean };
      can_write_order: { Args: { p_order_id: string; p_restaurant_id: string }; Returns: boolean };
      close_table_session: {
        Args: { p_session_id: string };
        Returns: {
          approved_at: string | null;
          approved_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          id: string;
          party_size: number | null;
          requested_at: string;
          restaurant_id: string;
          status: Database["public"]["Enums"]["table_session_status"];
          table_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "table_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      deactivate_restaurant_member: {
        Args: { p_member_id: string };
        Returns: {
          created_at: string;
          id: string;
          invited_by: string | null;
          is_active: boolean;
          restaurant_id: string;
          role: Database["public"]["Enums"]["restaurant_role"];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "restaurant_members";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      guest_can_order: {
        Args: { p_guest_session_id: string; p_restaurant_id: string; p_table_session_id: string };
        Returns: boolean;
      };
      guest_can_request: {
        Args: { p_guest_session_id: string; p_restaurant_id: string; p_table_session_id: string };
        Returns: boolean;
      };
      has_guest_session: { Args: { p_table_session_id: string }; Returns: boolean };
      has_restaurant_role: {
        Args: {
          p_restaurant_id: string;
          p_roles: Database["public"]["Enums"]["restaurant_role"][];
        };
        Returns: boolean;
      };
      invite_restaurant_staff: {
        Args: {
          p_email: string;
          p_restaurant_id: string;
          p_role: Database["public"]["Enums"]["restaurant_role"];
        };
        Returns: {
          email: string;
          expires_at: string;
          id: string;
          restaurant_id: string;
          role: Database["public"]["Enums"]["restaurant_role"];
          status: Database["public"]["Enums"]["staff_invitation_status"];
          token: string;
        }[];
      };
      is_category_public: { Args: { p_category_id: string }; Returns: boolean };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_restaurant_member: { Args: { p_restaurant_id: string }; Returns: boolean };
      is_restaurant_public: { Args: { p_restaurant_id: string }; Returns: boolean };
      owns_guest_session: { Args: { p_guest_session_id: string }; Returns: boolean };
      request_table_session: {
        Args: { p_party_size?: number; p_qr_token: string };
        Returns: {
          approved_at: string | null;
          approved_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          id: string;
          party_size: number | null;
          requested_at: string;
          restaurant_id: string;
          status: Database["public"]["Enums"]["table_session_status"];
          table_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "table_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_restaurant_application: {
        Args: {
          p_application_id: string;
          p_decision: Database["public"]["Enums"]["application_status"];
          p_plan_id?: string;
          p_reason?: string;
        };
        Returns: {
          applicant_name: string | null;
          applicant_phone: string | null;
          applicant_user_id: string;
          created_at: string;
          id: string;
          message: string | null;
          rejection_reason: string | null;
          restaurant_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "restaurant_applications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      revoke_restaurant_invitation: {
        Args: { p_invitation_id: string };
        Returns: {
          accepted_at: string | null;
          accepted_user_id: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          restaurant_id: string;
          role: Database["public"]["Enums"]["restaurant_role"];
          status: Database["public"]["Enums"]["staff_invitation_status"];
          token_hash: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "restaurant_staff_invitations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      shares_restaurant_with: { Args: { p_user_id: string }; Returns: boolean };
    };
    Enums: {
      application_status: "pending" | "approved" | "rejected";
      billing_interval: "monthly" | "yearly";
      operational_status: "active" | "suspended";
      order_event_type: "created" | "status_changed" | "note" | "cancelled";
      order_status: "placed" | "accepted" | "preparing" | "ready" | "served" | "cancelled";
      payment_attempt_status: "initiated" | "pending" | "successful" | "failed" | "cancelled";
      payment_provider: "snippe";
      payment_status: "pending" | "processing" | "successful" | "failed" | "cancelled" | "refunded";
      payment_webhook_status: "received" | "processed" | "failed" | "ignored";
      restaurant_role: "restaurant_admin" | "waiter" | "kitchen";
      staff_invitation_status: "pending" | "accepted" | "revoked" | "expired";
      subscription_status: "pending" | "active" | "past_due" | "cancelled" | "expired";
      table_session_status: "pending" | "active" | "closed";
      waiter_request_status: "open" | "acknowledged" | "resolved" | "cancelled";
      waiter_request_type: "assistance" | "bill" | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      application_status: ["pending", "approved", "rejected"],
      billing_interval: ["monthly", "yearly"],
      operational_status: ["active", "suspended"],
      order_event_type: ["created", "status_changed", "note", "cancelled"],
      order_status: ["placed", "accepted", "preparing", "ready", "served", "cancelled"],
      payment_attempt_status: ["initiated", "pending", "successful", "failed", "cancelled"],
      payment_provider: ["snippe"],
      payment_status: ["pending", "processing", "successful", "failed", "cancelled", "refunded"],
      payment_webhook_status: ["received", "processed", "failed", "ignored"],
      restaurant_role: ["restaurant_admin", "waiter", "kitchen"],
      staff_invitation_status: ["pending", "accepted", "revoked", "expired"],
      subscription_status: ["pending", "active", "past_due", "cancelled", "expired"],
      table_session_status: ["pending", "active", "closed"],
      waiter_request_status: ["open", "acknowledged", "resolved", "cancelled"],
      waiter_request_type: ["assistance", "bill", "other"],
    },
  },
} as const;
