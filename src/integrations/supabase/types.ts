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
      backup_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          estimated_size_mb: number | null
          file_hash: string | null
          file_size: number | null
          file_url: string | null
          id: string
          job_type: string
          last_error: string | null
          max_retries: number | null
          metadata: Json | null
          processed_items: number | null
          progress_percentage: number | null
          retry_count: number | null
          status: string
          storage_path: string | null
          tenant_id: string
          total_items: number | null
          tour_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_size_mb?: number | null
          file_hash?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          job_type: string
          last_error?: string | null
          max_retries?: number | null
          metadata?: Json | null
          processed_items?: number | null
          progress_percentage?: number | null
          retry_count?: number | null
          status?: string
          storage_path?: string | null
          tenant_id: string
          total_items?: number | null
          tour_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_size_mb?: number | null
          file_hash?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          max_retries?: number | null
          metadata?: Json | null
          processed_items?: number | null
          progress_percentage?: number | null
          retry_count?: number | null
          status?: string
          storage_path?: string | null
          tenant_id?: string
          total_items?: number | null
          tour_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_jobs_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_logs: {
        Row: {
          backup_job_id: string
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          is_error: boolean | null
          message: string
        }
        Insert: {
          backup_job_id: string
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          is_error?: boolean | null
          message: string
        }
        Update: {
          backup_job_id?: string
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          is_error?: boolean | null
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_logs_backup_job_id_fkey"
            columns: ["backup_job_id"]
            isOneToOne: false
            referencedRelation: "backup_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_queue: {
        Row: {
          attempts: number | null
          backup_job_id: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          locked_until: string | null
          max_attempts: number | null
          priority: number | null
          scheduled_at: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number | null
          backup_job_id: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          locked_until?: string | null
          max_attempts?: number | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number | null
          backup_job_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          locked_until?: string | null
          max_attempts?: number | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_queue_backup_job_id_fkey"
            columns: ["backup_job_id"]
            isOneToOne: false
            referencedRelation: "backup_jobs"
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
      email_logs: {
        Row: {
          created_at: string | null
          email_address: string
          error_message: string | null
          id: string
          metadata: Json | null
          notification_type: string
          resend_id: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_address: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          resend_id?: string | null
          sent_at?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_address?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      features: {
        Row: {
          created_at: string | null
          description: string | null
          feature_key: string
          feature_name: string
          id: string
          is_beta: boolean | null
          requires_subscription_tier: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feature_key: string
          feature_name: string
          id?: string
          is_beta?: boolean | null
          requires_subscription_tier?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feature_key?: string
          feature_name?: string
          id?: string
          is_beta?: boolean | null
          requires_subscription_tier?: string | null
          updated_at?: string | null
          version?: string
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
          tour_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      global_feature_config: {
        Row: {
          created_at: string | null
          default_enabled: boolean | null
          feature_id: string
          id: string
          rollout_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_enabled?: boolean | null
          feature_id: string
          id?: string
          rollout_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_enabled?: boolean | null
          feature_id?: string
          id?: string
          rollout_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_feature_config_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: true
            referencedRelation: "features"
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
          display_order: number | null
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
          display_order?: number | null
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
          display_order?: number | null
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
          original_filename: string | null
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
          original_filename?: string | null
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
          original_filename?: string | null
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
          account_status: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          account_status?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          account_status?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings_access_logs: {
        Row: {
          access_type: string
          created_at: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tenant_features: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          enabled_at: string | null
          feature_id: string
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          enabled_at?: string | null
          feature_id: string
          id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          enabled_at?: string | null
          feature_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_features_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
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
          id: string
          name: string
          owner_id: string
          settings: Json | null
          status: string | null
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          settings?: Json | null
          status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          settings?: Json | null
          status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_analytics: {
        Row: {
          avg_duration_seconds: number | null
          comments_count: number | null
          created_at: string
          id: string
          last_viewed_at: string | null
          likes_count: number | null
          tour_id: string
          unique_viewers: number | null
          updated_at: string
          views_count: number | null
        }
        Insert: {
          avg_duration_seconds?: number | null
          comments_count?: number | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          likes_count?: number | null
          tour_id: string
          unique_viewers?: number | null
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          avg_duration_seconds?: number | null
          comments_count?: number | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          likes_count?: number | null
          tour_id?: string
          unique_viewers?: number | null
          updated_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_analytics_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: true
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_comments: {
        Row: {
          comment_text: string
          commenter_email: string | null
          commenter_name: string | null
          created_at: string
          id: string
          is_read: boolean | null
          tour_id: string
          user_id: string | null
        }
        Insert: {
          comment_text: string
          commenter_email?: string | null
          commenter_name?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          tour_id: string
          user_id?: string | null
        }
        Update: {
          comment_text?: string
          commenter_email?: string | null
          commenter_name?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          tour_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_comments_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_shares: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_views: number | null
          permission_level: Database["public"]["Enums"]["share_permission"]
          share_token: string
          tour_id: string
          updated_at: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_views?: number | null
          permission_level?: Database["public"]["Enums"]["share_permission"]
          share_token: string
          tour_id: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_views?: number | null
          permission_level?: Database["public"]["Enums"]["share_permission"]
          share_token?: string
          tour_id?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tour_shares_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "virtual_tours"
            referencedColumns: ["id"]
          },
        ]
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
      user_approval_requests: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_approval_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_approval_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
          password_hash: string | null
          password_protected: boolean | null
          password_updated_at: string | null
          share_description: string | null
          share_image_url: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          password_hash?: string | null
          password_protected?: boolean | null
          password_updated_at?: string | null
          share_description?: string | null
          share_image_url?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          password_hash?: string | null
          password_protected?: boolean | null
          password_updated_at?: string | null
          share_description?: string | null
          share_image_url?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_tours_organization_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_user: {
        Args: { _approved_by: string; _notes?: string; _user_id: string }
        Returns: undefined
      }
      auto_cleanup_old_backup_jobs: { Args: never; Returns: undefined }
      belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_old_backup_jobs: { Args: never; Returns: number }
      cleanup_stalled_backup_jobs: { Args: never; Returns: undefined }
      generate_share_token: { Args: never; Returns: string }
      get_user_tenants: {
        Args: { _user_id: string }
        Returns: {
          tenant_id: string
          tenant_name: string
          user_role: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_feature_enabled: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      process_backup_queue: {
        Args: never
        Returns: {
          failed_count: number
          processed_count: number
          total_processed: number
        }[]
      }
      reject_user: {
        Args: { _notes?: string; _rejected_by: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      share_permission: "view" | "comment" | "edit"
      tenant_role: "tenant_admin" | "member"
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
      share_permission: ["view", "comment", "edit"],
      tenant_role: ["tenant_admin", "member"],
    },
  },
} as const
