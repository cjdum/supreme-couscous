export type ModCategory =
  | "engine"
  | "suspension"
  | "aero"
  | "interior"
  | "wheels"
  | "exhaust"
  | "electronics"
  | "other";

export type ModStatus = "installed" | "wishlist";

export type ForumCategory = "general" | "build" | "advice" | "showcase" | "for_sale";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string;
        };
      };
      cars: {
        Row: {
          id: string;
          user_id: string;
          vin: string | null;
          make: string;
          model: string;
          year: number;
          trim: string | null;
          color: string | null;
          nickname: string | null;
          cover_image_url: string | null;
          is_public: boolean;
          horsepower: number | null;
          torque: number | null;
          engine_size: string | null;
          drivetrain: string | null;
          transmission: string | null;
          curb_weight: number | null;
          zero_to_sixty: number | null;
          top_speed: number | null;
          specs_ai_guessed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vin?: string | null;
          make: string;
          model: string;
          year: number;
          trim?: string | null;
          color?: string | null;
          nickname?: string | null;
          cover_image_url?: string | null;
          is_public?: boolean;
          horsepower?: number | null;
          torque?: number | null;
          engine_size?: string | null;
          drivetrain?: string | null;
          transmission?: string | null;
          curb_weight?: number | null;
          zero_to_sixty?: number | null;
          top_speed?: number | null;
          specs_ai_guessed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          vin?: string | null;
          make?: string;
          model?: string;
          year?: number;
          trim?: string | null;
          color?: string | null;
          nickname?: string | null;
          cover_image_url?: string | null;
          is_public?: boolean;
          horsepower?: number | null;
          torque?: number | null;
          engine_size?: string | null;
          drivetrain?: string | null;
          transmission?: string | null;
          curb_weight?: number | null;
          zero_to_sixty?: number | null;
          top_speed?: number | null;
          specs_ai_guessed?: boolean;
          updated_at?: string;
        };
      };
      mods: {
        Row: {
          id: string;
          car_id: string;
          user_id: string;
          name: string;
          category: ModCategory;
          cost: number | null;
          install_date: string | null;
          shop_name: string | null;
          is_diy: boolean;
          notes: string | null;
          status: ModStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          car_id: string;
          user_id: string;
          name: string;
          category: ModCategory;
          cost?: number | null;
          install_date?: string | null;
          shop_name?: string | null;
          is_diy?: boolean;
          notes?: string | null;
          status?: ModStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          category?: ModCategory;
          cost?: number | null;
          install_date?: string | null;
          shop_name?: string | null;
          is_diy?: boolean;
          notes?: string | null;
          status?: ModStatus;
          updated_at?: string;
        };
      };
      mod_photos: {
        Row: {
          id: string;
          mod_id: string;
          car_id: string;
          user_id: string;
          url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          mod_id: string;
          car_id: string;
          user_id: string;
          url: string;
          created_at?: string;
        };
        Update: never;
      };
      renders: {
        Row: {
          id: string;
          car_id: string;
          user_id: string;
          user_prompt: string;
          image_prompt: string;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          car_id: string;
          user_id: string;
          user_prompt: string;
          image_prompt: string;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          image_url?: string | null;
        };
      };
      likes: {
        Row: {
          id: string;
          user_id: string;
          car_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          car_id: string;
          created_at?: string;
        };
        Update: never;
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          car_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          car_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
      };
      forum_posts: {
        Row: {
          id: string;
          user_id: string;
          car_id: string | null;
          title: string;
          content: string;
          category: ForumCategory;
          likes_count: number;
          replies_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          car_id?: string | null;
          title: string;
          content: string;
          category?: ForumCategory;
          likes_count?: number;
          replies_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
          category?: ForumCategory;
          likes_count?: number;
          replies_count?: number;
          updated_at?: string;
        };
      };
      forum_replies: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          content: string;
          created_at?: string;
        };
        Update: never;
      };
      forum_likes: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: never;
      };
    };
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: {
      mod_category: ModCategory;
      mod_status: ModStatus;
    };
  };
}

// Convenience row types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Car = Database["public"]["Tables"]["cars"]["Row"];
export type Mod = Database["public"]["Tables"]["mods"]["Row"];
export type ModPhoto = Database["public"]["Tables"]["mod_photos"]["Row"];
export type Render = Database["public"]["Tables"]["renders"]["Row"];
export type Like = Database["public"]["Tables"]["likes"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type ForumPost = Database["public"]["Tables"]["forum_posts"]["Row"];
export type ForumReply = Database["public"]["Tables"]["forum_replies"]["Row"];
export type ForumLike = Database["public"]["Tables"]["forum_likes"]["Row"];
