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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          category: Database["public"]["Enums"]["activity_category"]
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          meta: Json
          name: string
          tenant_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["activity_category"]
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          meta?: Json
          name: string
          tenant_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["activity_category"]
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          meta?: Json
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          country_code: Database["public"]["Enums"]["country_code"]
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          tenant_id: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          country_code?: Database["public"]["Enums"]["country_code"]
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          tenant_id: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          country_code?: Database["public"]["Enums"]["country_code"]
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          tenant_id?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_name: string
          country: string | null
          country_code: Database["public"]["Enums"]["country_code"]
          created_at: string
          default_document_language: Database["public"]["Enums"]["document_language"]
          email: string | null
          fr_legal_form: Database["public"]["Enums"]["fr_legal_form"] | null
          fr_seller_profile:
            | Database["public"]["Enums"]["fr_seller_profile"]
            | null
          id: string
          invoice_defaults: Json
          is_primary: boolean
          legal_entity_type: Database["public"]["Enums"]["legal_entity_type"]
          legal_name: string | null
          legal_requirements: Json
          logo_url: string | null
          payment_defaults: Json
          phone: string | null
          postal_code: string | null
          regulated_activity_flags: Json
          siren: string | null
          siret: string | null
          tenant_id: string
          updated_at: string
          vat_number: string | null
          vat_regime: Database["public"]["Enums"]["vat_regime"]
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name: string
          country?: string | null
          country_code?: Database["public"]["Enums"]["country_code"]
          created_at?: string
          default_document_language?: Database["public"]["Enums"]["document_language"]
          email?: string | null
          fr_legal_form?: Database["public"]["Enums"]["fr_legal_form"] | null
          fr_seller_profile?:
            | Database["public"]["Enums"]["fr_seller_profile"]
            | null
          id?: string
          invoice_defaults?: Json
          is_primary?: boolean
          legal_entity_type?: Database["public"]["Enums"]["legal_entity_type"]
          legal_name?: string | null
          legal_requirements?: Json
          logo_url?: string | null
          payment_defaults?: Json
          phone?: string | null
          postal_code?: string | null
          regulated_activity_flags?: Json
          siren?: string | null
          siret?: string | null
          tenant_id: string
          updated_at?: string
          vat_number?: string | null
          vat_regime?: Database["public"]["Enums"]["vat_regime"]
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string
          country?: string | null
          country_code?: Database["public"]["Enums"]["country_code"]
          created_at?: string
          default_document_language?: Database["public"]["Enums"]["document_language"]
          email?: string | null
          fr_legal_form?: Database["public"]["Enums"]["fr_legal_form"] | null
          fr_seller_profile?:
            | Database["public"]["Enums"]["fr_seller_profile"]
            | null
          id?: string
          invoice_defaults?: Json
          is_primary?: boolean
          legal_entity_type?: Database["public"]["Enums"]["legal_entity_type"]
          legal_name?: string | null
          legal_requirements?: Json
          logo_url?: string | null
          payment_defaults?: Json
          phone?: string | null
          postal_code?: string | null
          regulated_activity_flags?: Json
          siren?: string | null
          siret?: string | null
          tenant_id?: string
          updated_at?: string
          vat_number?: string | null
          vat_regime?: Database["public"]["Enums"]["vat_regime"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      country_profiles: {
        Row: {
          code: Database["public"]["Enums"]["country_code"]
          config: Json
          created_at: string
          default_currency: string
          default_locale: string
          id: string
          name: string
        }
        Insert: {
          code: Database["public"]["Enums"]["country_code"]
          config?: Json
          created_at?: string
          default_currency?: string
          default_locale?: string
          id?: string
          name: string
        }
        Update: {
          code?: Database["public"]["Enums"]["country_code"]
          config?: Json
          created_at?: string
          default_currency?: string
          default_locale?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          code: string
          config: Json
          country_code: Database["public"]["Enums"]["country_code"]
          id: string
          kind: string
          name: string
        }
        Insert: {
          code: string
          config?: Json
          country_code: Database["public"]["Enums"]["country_code"]
          id?: string
          kind: string
          name: string
        }
        Update: {
          code?: string
          config?: Json
          country_code?: Database["public"]["Enums"]["country_code"]
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          description: string | null
          id: string
          is_limit: boolean
          key: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_limit?: boolean
          key: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          is_limit?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          accounting_category: string | null
          activity_id: string | null
          created_at: string
          default_document_behavior: Json
          default_unit: string | null
          default_unit_price: number | null
          default_vat_rate: number | null
          description: string | null
          id: string
          is_active: boolean
          item_type: Database["public"]["Enums"]["item_type"]
          name: string
          tenant_id: string
        }
        Insert: {
          accounting_category?: string | null
          activity_id?: string | null
          created_at?: string
          default_document_behavior?: Json
          default_unit?: string | null
          default_unit_price?: number | null
          default_vat_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["item_type"]
          name: string
          tenant_id: string
        }
        Update: {
          accounting_category?: string | null
          activity_id?: string | null
          created_at?: string
          default_document_behavior?: Json
          default_unit?: string | null
          default_unit_price?: number | null
          default_vat_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["item_type"]
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_phrases: {
        Row: {
          conditions: Json
          country_code: Database["public"]["Enums"]["country_code"]
          id: string
          key: string
          language: Database["public"]["Enums"]["document_language"]
          text: string
        }
        Insert: {
          conditions?: Json
          country_code: Database["public"]["Enums"]["country_code"]
          id?: string
          key: string
          language: Database["public"]["Enums"]["document_language"]
          text: string
        }
        Update: {
          conditions?: Json
          country_code?: Database["public"]["Enums"]["country_code"]
          id?: string
          key?: string
          language?: Database["public"]["Enums"]["document_language"]
          text?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          enabled: boolean
          feature_id: string
          id: string
          limit_value: number | null
          plan_id: string
        }
        Insert: {
          enabled?: boolean
          feature_id: string
          id?: string
          limit_value?: number | null
          plan_id: string
        }
        Update: {
          enabled?: boolean
          feature_id?: string
          id?: string
          limit_value?: number | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          interface_language: Database["public"]["Enums"]["interface_language"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          interface_language?: Database["public"]["Enums"]["interface_language"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          interface_language?: Database["public"]["Enums"]["interface_language"]
          updated_at?: string
        }
        Relationships: []
      }
      tenant_feature_overrides: {
        Row: {
          created_at: string
          enabled: boolean | null
          feature_id: string
          id: string
          limit_value: number | null
          reason: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean | null
          feature_id: string
          id?: string
          limit_value?: number | null
          reason?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean | null
          feature_id?: string
          id?: string
          limit_value?: number | null
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_overrides_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_feature_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          plan_id: string
          started_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id: string
          started_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          default_country: Database["public"]["Enums"]["country_code"]
          default_document_language: Database["public"]["Enums"]["document_language"]
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_country?: Database["public"]["Enums"]["country_code"]
          default_document_language?: Database["public"]["Enums"]["document_language"]
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_country?: Database["public"]["Enums"]["country_code"]
          default_document_language?: Database["public"]["Enums"]["document_language"]
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      translations: {
        Row: {
          id: string
          key: string
          language: Database["public"]["Enums"]["interface_language"]
          namespace: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          language: Database["public"]["Enums"]["interface_language"]
          namespace: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          language?: Database["public"]["Enums"]["interface_language"]
          namespace?: string
          value?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          feature_key: string
          id: string
          period_end: string
          period_start: string
          tenant_id: string
          value: number
        }
        Insert: {
          feature_key: string
          id?: string
          period_end: string
          period_start: string
          tenant_id: string
          value?: number
        }
        Update: {
          feature_key?: string
          id?: string
          period_end?: string
          period_start?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_initial_tenant: { Args: { _name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      tenant_role_of: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["tenant_role"]
      }
    }
    Enums: {
      activity_category:
        | "web_design"
        | "web_development"
        | "consulting"
        | "digital_services"
        | "goods_sales"
        | "ecommerce"
        | "physical_production"
        | "mixed"
        | "other"
      app_role: "super_admin"
      audit_actor_type: "user" | "super_admin" | "system"
      client_type: "company" | "individual"
      country_code: "FR"
      document_language: "fr" | "en" | "ru"
      fr_legal_form:
        | "micro_entrepreneur"
        | "ei"
        | "eirl"
        | "eurl"
        | "sarl"
        | "sas"
        | "sasu"
        | "sa"
        | "sci"
        | "association"
        | "other"
      fr_seller_profile:
        | "micro_bnc"
        | "micro_bic_services"
        | "micro_bic_goods"
        | "reel_simplifie"
        | "reel_normal"
        | "franchise_base_tva"
        | "other"
      interface_language: "fr" | "en" | "ru"
      item_type: "service" | "good" | "mixed"
      legal_entity_type: "individual" | "company"
      tenant_role: "owner" | "admin" | "member" | "viewer"
      vat_regime:
        | "franchise_base"
        | "reel_simplifie"
        | "reel_normal"
        | "not_applicable"
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
      activity_category: [
        "web_design",
        "web_development",
        "consulting",
        "digital_services",
        "goods_sales",
        "ecommerce",
        "physical_production",
        "mixed",
        "other",
      ],
      app_role: ["super_admin"],
      audit_actor_type: ["user", "super_admin", "system"],
      client_type: ["company", "individual"],
      country_code: ["FR"],
      document_language: ["fr", "en", "ru"],
      fr_legal_form: [
        "micro_entrepreneur",
        "ei",
        "eirl",
        "eurl",
        "sarl",
        "sas",
        "sasu",
        "sa",
        "sci",
        "association",
        "other",
      ],
      fr_seller_profile: [
        "micro_bnc",
        "micro_bic_services",
        "micro_bic_goods",
        "reel_simplifie",
        "reel_normal",
        "franchise_base_tva",
        "other",
      ],
      interface_language: ["fr", "en", "ru"],
      item_type: ["service", "good", "mixed"],
      legal_entity_type: ["individual", "company"],
      tenant_role: ["owner", "admin", "member", "viewer"],
      vat_regime: [
        "franchise_base",
        "reel_simplifie",
        "reel_normal",
        "not_applicable",
      ],
    },
  },
} as const
