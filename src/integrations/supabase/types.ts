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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          back: string
          created_at: string
          difficulty: number
          due: string
          elapsed_days: number
          front: string
          furniture_id: string | null
          id: string
          last_review: string | null
          palace_id: string | null
          reps: number
          scheduled_days: number
          stability: number
          state: number
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          front: string
          furniture_id?: string | null
          id?: string
          last_review?: string | null
          palace_id?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          front?: string
          furniture_id?: string | null
          id?: string
          last_review?: string | null
          palace_id?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          user_id?: string
        }
        Relationships: []
      }
      city_style_assets: {
        Row: {
          asset_type: string
          config: Json | null
          created_at: string | null
          id: string
          image_url: string
          is_default: boolean | null
          name: string
          thumbnail_url: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          asset_type: string
          config?: Json | null
          created_at?: string | null
          id?: string
          image_url: string
          is_default?: boolean | null
          name: string
          thumbnail_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          asset_type?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          image_url?: string
          is_default?: boolean | null
          name?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      city_visits: {
        Row: {
          city_owner_id: string
          id: string
          visited_at: string
          visitor_id: string
        }
        Insert: {
          city_owner_id: string
          id?: string
          visited_at?: string
          visitor_id: string
        }
        Update: {
          city_owner_id?: string
          id?: string
          visited_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      avatar_items: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          image_url: string
          layer_z_index: number
          base_price: number
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          image_url: string
          layer_z_index?: number
          base_price?: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          image_url?: string
          layer_z_index?: number
          base_price?: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_avatar_config: {
        Row: {
          user_id: string
          equipped_items: Json
          custom_offsets: Json
          updated_at: string
        }
        Insert: {
          user_id: string
          equipped_items?: Json
          custom_offsets?: Json
          updated_at?: string
        }
        Update: {
          user_id?: string
          equipped_items?: Json
          custom_offsets?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_avatar_config_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      content_reference: {
        Row: {
          category_tags: string[] | null
          content: string
          created_at: string | null
          created_by: string | null
          description: string | null
          grade_level: string | null
          id: string
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category_tags?: string[] | null
          content: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          grade_level?: string | null
          id?: string
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category_tags?: string[] | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          grade_level?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_reference_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      default_user_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      items_catalog: {
        Row: {
          category: string | null
          created_at: string | null
          default_properties: Json | null
          id: string
          name: string
          sprite_key: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          default_properties?: Json | null
          id?: string
          name: string
          sprite_key?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          default_properties?: Json | null
          id?: string
          name?: string
          sprite_key?: string | null
        }
        Relationships: []
      }
      memories: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          item_instance_id: string | null
          position: Json | null
          room_id: string | null
          target_type: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          item_instance_id?: string | null
          position?: Json | null
          room_id?: string | null
          target_type?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          item_instance_id?: string | null
          position?: Json | null
          room_id?: string | null
          target_type?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      memorization_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          completed: boolean | null
          completed_at: string | null
          content_id: string
          created_at: string | null
          due_date: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          completed?: boolean | null
          completed_at?: string | null
          content_id: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          completed?: boolean | null
          completed_at?: string | null
          content_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorization_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorization_assignments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "saved_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorization_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          message: string
          title: string
          type: "positive" | "neutral" | "negative"
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          title: string
          type: "positive" | "neutral" | "negative"
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          title?: string
          type?: "positive" | "neutral" | "negative"
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      phonics_sounds: {
        Row: {
          audio_url: string
          category: string | null
          created_at: string | null
          display_name: string
          id: string
          sort_order: number | null
          sound_code: string
        }
        Insert: {
          audio_url: string
          category?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          sort_order?: number | null
          sound_code: string
        }
        Update: {
          audio_url?: string
          category?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          sort_order?: number | null
          sound_code?: string
        }
        Relationships: []
      }
      practice_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          completed: boolean | null
          completed_at: string | null
          due_date: string | null
          id: string
          practice_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          completed?: boolean | null
          completed_at?: string | null
          due_date?: string | null
          id?: string
          practice_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          completed?: boolean | null
          completed_at?: string | null
          due_date?: string | null
          id?: string
          practice_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "spelling_practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      proofreading_practice_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          due_date: string | null
          id: string
          practice_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          practice_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          practice_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proofreading_practice_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofreading_practice_assignments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "proofreading_practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofreading_practice_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      proofreading_practices: {
        Row: {
          answers: Json
          created_at: string | null
          id: string
          sentences: Json
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answers: Json
          created_at?: string | null
          id?: string
          sentences: Json
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string | null
          id?: string
          sentences?: Json
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proofreading_practices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      public_facilities: {
        Row: {
          config: Json
          created_at: string
          facility_type: Database["public"]["Enums"]["facility_type"]
          id: string
          level: number
          name: string
          plot_id: string | null
          position_x: number
          position_y: number
          region_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          facility_type: Database["public"]["Enums"]["facility_type"]
          id?: string
          level?: number
          name: string
          plot_id?: string | null
          position_x: number
          position_y: number
          region_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          facility_type?: Database["public"]["Enums"]["facility_type"]
          id?: string
          level?: number
          name?: string
          plot_id?: string | null
          position_x?: number
          position_y?: number
          region_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_facilities_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "region_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_facilities_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      region_map_elements: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          region_id: string
          updated_at: string
          x: number
          y: number
          z_index: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          region_id: string
          updated_at?: string
          x: number
          y: number
          z_index?: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          region_id?: string
          updated_at?: string
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "region_map_elements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "city_style_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_map_elements_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      region_plots: {
        Row: {
          city_level: number | null
          city_name: string | null
          created_at: string
          id: string
          owner_id: string | null
          plot_type: Database["public"]["Enums"]["plot_type"]
          position_x: number
          position_y: number
          region_id: string
          size_depth: number
          size_width: number
          updated_at: string
        }
        Insert: {
          city_level?: number | null
          city_name?: string | null
          created_at?: string
          id?: string
          owner_id?: string | null
          plot_type?: Database["public"]["Enums"]["plot_type"]
          position_x: number
          position_y: number
          region_id: string
          size_depth?: number
          size_width?: number
          updated_at?: string
        }
        Update: {
          city_level?: number | null
          city_name?: string | null
          created_at?: string
          id?: string
          owner_id?: string | null
          plot_type?: Database["public"]["Enums"]["plot_type"]
          position_x?: number
          position_y?: number
          region_id?: string
          size_depth?: number
          size_width?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "region_plots_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          created_at: string
          grid_size: number
          id: string
          name: string
          theme: Database["public"]["Enums"]["region_theme"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          grid_size?: number
          id?: string
          name: string
          theme?: Database["public"]["Enums"]["region_theme"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          grid_size?: number
          id?: string
          name?: string
          theme?: Database["public"]["Enums"]["region_theme"]
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          layout: Json | null
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          layout?: Json | null
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          layout?: Json | null
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      saved_contents: {
        Row: {
          created_at: string | null
          id: string
          is_published: boolean | null
          original_text: string
          public_id: string | null
          selected_word_indices: Json
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          original_text: string
          public_id?: string | null
          selected_word_indices?: Json
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          original_text?: string
          public_id?: string | null
          selected_word_indices?: Json
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_contents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_records: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_read: boolean | null
          message: string
          student_id: string
          type: "positive" | "neutral" | "negative"
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          student_id: string
          type: "positive" | "neutral" | "negative"
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          student_id?: string
          type?: "positive" | "neutral" | "negative"
        }
        Relationships: [
          {
            foreignKeyName: "student_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      spelling_practices: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          title: string
          updated_at: string | null
          words: string[]
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          title: string
          updated_at?: string | null
          words: string[]
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          title?: string
          updated_at?: string | null
          words?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "spelling_practices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
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
      user_room_data: {
        Row: {
          active_floor_id: string | null
          active_wall_id: string | null
          coins: number | null
          virtual_coins: number | null
          daily_counts: Json | null
          created_at: string | null
          custom_catalog: Json | null
          custom_floors: Json | null
          custom_models: Json | null
          custom_walls: Json | null
          house_level: number | null
          id: string
          inventory: string[] | null
          placements: Json | null
          room_id: string | null
          updated_at: string | null
          user_id: string
          wall_placements: Json | null
        }
        Insert: {
          active_floor_id?: string | null
          active_wall_id?: string | null
          coins?: number | null
          virtual_coins?: number | null
          daily_counts?: Json | null
          created_at?: string | null
          custom_catalog?: Json | null
          custom_floors?: Json | null
          custom_models?: Json | null
          custom_walls?: Json | null
          house_level?: number | null
          id?: string
          inventory?: string[] | null
          placements?: Json | null
          room_id?: string | null
          updated_at?: string | null
          user_id: string
          wall_placements?: Json | null
        }
        Update: {
          active_floor_id?: string | null
          active_wall_id?: string | null
          coins?: number | null
          virtual_coins?: number | null
          daily_counts?: Json | null
          created_at?: string | null
          custom_catalog?: Json | null
          custom_floors?: Json | null
          custom_models?: Json | null
          custom_walls?: Json | null
          house_level?: number | null
          id?: string
          inventory?: string[] | null
          placements?: Json | null
          room_id?: string | null
          updated_at?: string | null
          user_id?: string
          wall_placements?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "user_room_data_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          role: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id: string
          role?: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_assignments_admin_view: {
        Args: {
          filter_status?: string
          filter_student_id?: string
          filter_type?: string
          sort_by?: string
          sort_order?: string
        }
        Returns: {
          assigned_at: string
          assigned_by_username: string
          assignment_id: string
          assignment_type: string
          completed: boolean
          completed_at: string
          due_date: string
          is_overdue: boolean
          student_display_name: string
          student_id: string
          student_username: string
          title: string
        }[]
      }
      get_all_assignments_overview: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      facility_type:
      | "park"
      | "school"
      | "library"
      | "town_hall"
      | "train_station"
      | "marketplace"
      plot_type: "city" | "public_facility" | "empty"
      region_theme: "countryside" | "suburban" | "urban"
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
      app_role: ["admin", "moderator", "user"],
      facility_type: [
        "park",
        "school",
        "library",
        "town_hall",
        "train_station",
        "marketplace",
      ],
      plot_type: ["city", "public_facility", "empty"],
      region_theme: ["countryside", "suburban", "urban"],
    },
  },
} as const
