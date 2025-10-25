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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analytics_summary: {
        Row: {
          avg_duration_seconds: number | null
          created_at: string
          date: string
          id: string
          total_views: number | null
          tour_id: string
          unique_viewers: number | null
          updated_at: string
        }
        Insert: {
          avg_duration_seconds?: number | null
          created_at?: string
          date: string
          id?: string
          total_views?: number | null
          tour_id: string
          unique_viewers?: number | null
          updated_at?: string
        }
        Update: {
          avg_duration_seconds?: number | null
          created_at?: string
          date?: string
          id?: string
          total_views?: number | null
          tour_id?: string
          unique_viewers?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_summary_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      commands: {
        Row: {
          command_number: number
          command_text: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          command_number: number
          command_text: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          command_number?: number
          command_text?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      floor_plans: {
        Row: {
          capture_date: string | null
          created_at: string
          height: number
          id: string
          image_url: string
          name: string
          tour_id: string
          width: number
        }
        Insert: {
          capture_date?: string | null
          created_at?: string
          height: number
          id?: string
          image_url: string
          name: string
          tour_id: string
          width: number
        }
        Update: {
          capture_date?: string | null
          created_at?: string
          height?: number
          id?: string
          image_url?: string
          name?: string
          tour_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      golden_rules: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          rule_number: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          rule_number: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          rule_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotspots: {
        Row: {
          created_at: string
          description: string | null
          floor_plan_id: string
          has_panorama: boolean | null
          id: string
          media_type: string | null
          media_url: string | null
          panorama_count: number | null
          title: string
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          floor_plan_id: string
          has_panorama?: boolean | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          panorama_count?: number | null
          title: string
          x_position: number
          y_position: number
        }
        Update: {
          created_at?: string
          description?: string | null
          floor_plan_id?: string
          has_panorama?: boolean | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          panorama_count?: number | null
          title?: string
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotspots_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          email_on_new_user: boolean | null
          email_on_new_view: boolean | null
          email_weekly_report: boolean | null
          id: string
          push_on_new_view: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_on_new_user?: boolean | null
          email_on_new_view?: boolean | null
          email_weekly_report?: boolean | null
          id?: string
          push_on_new_view?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_on_new_user?: boolean | null
          email_on_new_view?: boolean | null
          email_weekly_report?: boolean | null
          id?: string
          push_on_new_view?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          related_tour_id: string | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          related_tour_id?: string | null
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          related_tour_id?: string | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_tour_id_fkey"
            columns: ["related_tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_locked: boolean
          name: string
          route: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean
          name: string
          route: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean
          name?: string
          route?: string
          updated_at?: string
        }
        Relationships: []
      }
      panorama_photos: {
        Row: {
          capture_date: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          hotspot_id: string
          id: string
          photo_url: string
          photo_url_mobile: string | null
          photo_url_thumbnail: string | null
        }
        Insert: {
          capture_date?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          hotspot_id: string
          id?: string
          photo_url: string
          photo_url_mobile?: string | null
          photo_url_thumbnail?: string | null
        }
        Update: {
          capture_date?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          hotspot_id?: string
          id?: string
          photo_url?: string
          photo_url_mobile?: string | null
          photo_url_thumbnail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panorama_photos_hotspot_id_fkey"
            columns: ["hotspot_id"]
            isOneToOne: false
            referencedRelation: "hotspots"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tour_views: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          ip_address: string | null
          session_id: string | null
          tour_id: string
          user_agent: string | null
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
          tour_id: string
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
          tour_id?: string
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_views_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_downloads: boolean | null
          auto_reports: boolean | null
          autoplay: boolean | null
          backup_frequency: string | null
          cloud_sync: boolean | null
          color_scheme: string | null
          contact_preferences: Json | null
          created_at: string | null
          cross_device_sync: boolean | null
          currency: string | null
          data_sharing: boolean | null
          data_usage: string | null
          date_format: string | null
          default_volume: number | null
          email_notifications: boolean | null
          font_size: string | null
          id: string
          image_quality: string | null
          in_app_notifications: boolean | null
          language: string | null
          layout_mode: string | null
          local_storage_limit_mb: number | null
          metrics_to_track: Json | null
          notification_types: Json | null
          profile_visibility: string | null
          push_notifications: boolean | null
          report_frequency: string | null
          share_usage_data: boolean | null
          sound_effects: boolean | null
          subscription_tier: string | null
          sync_data_types: Json | null
          theme: string | null
          time_format: string | null
          timezone: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
          user_id: string
          video_quality: string | null
        }
        Insert: {
          auto_downloads?: boolean | null
          auto_reports?: boolean | null
          autoplay?: boolean | null
          backup_frequency?: string | null
          cloud_sync?: boolean | null
          color_scheme?: string | null
          contact_preferences?: Json | null
          created_at?: string | null
          cross_device_sync?: boolean | null
          currency?: string | null
          data_sharing?: boolean | null
          data_usage?: string | null
          date_format?: string | null
          default_volume?: number | null
          email_notifications?: boolean | null
          font_size?: string | null
          id?: string
          image_quality?: string | null
          in_app_notifications?: boolean | null
          language?: string | null
          layout_mode?: string | null
          local_storage_limit_mb?: number | null
          metrics_to_track?: Json | null
          notification_types?: Json | null
          profile_visibility?: string | null
          push_notifications?: boolean | null
          report_frequency?: string | null
          share_usage_data?: boolean | null
          sound_effects?: boolean | null
          subscription_tier?: string | null
          sync_data_types?: Json | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
          video_quality?: string | null
        }
        Update: {
          auto_downloads?: boolean | null
          auto_reports?: boolean | null
          autoplay?: boolean | null
          backup_frequency?: string | null
          cloud_sync?: boolean | null
          color_scheme?: string | null
          contact_preferences?: Json | null
          created_at?: string | null
          cross_device_sync?: boolean | null
          currency?: string | null
          data_sharing?: boolean | null
          data_usage?: string | null
          date_format?: string | null
          default_volume?: number | null
          email_notifications?: boolean | null
          font_size?: string | null
          id?: string
          image_quality?: string | null
          in_app_notifications?: boolean | null
          language?: string | null
          layout_mode?: string | null
          local_storage_limit_mb?: number | null
          metrics_to_track?: Json | null
          notification_types?: Json | null
          profile_visibility?: string | null
          push_notifications?: boolean | null
          report_frequency?: string | null
          share_usage_data?: boolean | null
          sound_effects?: boolean | null
          subscription_tier?: string | null
          sync_data_types?: Json | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
          video_quality?: string | null
        }
        Relationships: []
      }
      virtual_tours: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          organization_id: string
          password_hash: string | null
          password_protected: boolean | null
          password_updated_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          organization_id: string
          password_hash?: string | null
          password_protected?: boolean | null
          password_updated_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          organization_id?: string
          password_hash?: string | null
          password_protected?: boolean | null
          password_updated_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_tours_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
