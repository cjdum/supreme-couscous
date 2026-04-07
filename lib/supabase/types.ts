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
          is_public: boolean;
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
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          is_public?: boolean;
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
          is_primary: boolean;
          horsepower: number | null;
          torque: number | null;
          engine_size: string | null;
          drivetrain: string | null;
          transmission: string | null;
          curb_weight: number | null;
          zero_to_sixty: number | null;
          top_speed: number | null;
          specs_ai_guessed: boolean;
          stock_horsepower: number | null;
          stock_torque: number | null;
          stock_curb_weight: number | null;
          stock_zero_to_sixty: number | null;
          stock_top_speed: number | null;
          stock_engine_size: string | null;
          stock_drivetrain: string | null;
          stock_transmission: string | null;
          description: string | null;
          pixel_card_url: string | null;
          pixel_card_nickname: string | null;
          pixel_card_generated_at: string | null;
          pixel_card_hp: number | null;
          pixel_card_mod_count: number | null;
          pixel_card_build_score: number | null;
          pixel_card_rarity: string | null;
          vin_verified: boolean;
          is_sold: boolean;
          sold_at: string | null;
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
          is_primary?: boolean;
          horsepower?: number | null;
          torque?: number | null;
          engine_size?: string | null;
          drivetrain?: string | null;
          transmission?: string | null;
          curb_weight?: number | null;
          zero_to_sixty?: number | null;
          top_speed?: number | null;
          specs_ai_guessed?: boolean;
          stock_horsepower?: number | null;
          stock_torque?: number | null;
          stock_curb_weight?: number | null;
          stock_zero_to_sixty?: number | null;
          stock_top_speed?: number | null;
          stock_engine_size?: string | null;
          stock_drivetrain?: string | null;
          stock_transmission?: string | null;
          description?: string | null;
          pixel_card_url?: string | null;
          pixel_card_nickname?: string | null;
          pixel_card_generated_at?: string | null;
          pixel_card_hp?: number | null;
          pixel_card_mod_count?: number | null;
          pixel_card_build_score?: number | null;
          pixel_card_rarity?: string | null;
          vin_verified?: boolean;
          is_sold?: boolean;
          sold_at?: string | null;
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
          is_primary?: boolean;
          horsepower?: number | null;
          torque?: number | null;
          engine_size?: string | null;
          drivetrain?: string | null;
          transmission?: string | null;
          curb_weight?: number | null;
          zero_to_sixty?: number | null;
          top_speed?: number | null;
          specs_ai_guessed?: boolean;
          stock_horsepower?: number | null;
          stock_torque?: number | null;
          stock_curb_weight?: number | null;
          stock_zero_to_sixty?: number | null;
          stock_top_speed?: number | null;
          stock_engine_size?: string | null;
          stock_drivetrain?: string | null;
          stock_transmission?: string | null;
          description?: string | null;
          pixel_card_url?: string | null;
          pixel_card_nickname?: string | null;
          pixel_card_generated_at?: string | null;
          pixel_card_hp?: number | null;
          pixel_card_mod_count?: number | null;
          pixel_card_build_score?: number | null;
          pixel_card_rarity?: string | null;
          vin_verified?: boolean;
          is_sold?: boolean;
          sold_at?: string | null;
          updated_at?: string;
        };
      };
      car_photos: {
        Row: {
          id: string;
          car_id: string;
          user_id: string;
          url: string;
          position: number;
          is_cover: boolean;
          image_descriptor: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          car_id: string;
          user_id: string;
          url: string;
          position?: number;
          is_cover?: boolean;
          image_descriptor?: string | null;
          created_at?: string;
        };
        Update: {
          position?: number;
          is_cover?: boolean;
          image_descriptor?: string | null;
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
          is_banner: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          car_id: string;
          user_id: string;
          user_prompt: string;
          image_prompt: string;
          image_url?: string | null;
          is_banner?: boolean;
          created_at?: string;
        };
        Update: {
          image_url?: string | null;
          is_banner?: boolean;
        };
      };
      user_awards: {
        Row: {
          id: string;
          user_id: string;
          award_id: string;
          unlocked_at: string;
          is_featured: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          award_id: string;
          unlocked_at?: string;
          is_featured?: boolean;
        };
        Update: {
          is_featured?: boolean;
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
      forum_downvotes: {
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
      purchases: {
        Row: {
          id: string;
          user_id: string;
          car_id: string | null;
          mod_id: string | null;
          item_name: string;
          price: number;
          retailer: string | null;
          purchased_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          car_id?: string | null;
          mod_id?: string | null;
          item_name: string;
          price: number;
          retailer?: string | null;
          purchased_at?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          item_name?: string;
          price?: number;
          retailer?: string | null;
          purchased_at?: string;
          notes?: string | null;
          mod_id?: string | null;
        };
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
export type CarPhoto = Database["public"]["Tables"]["car_photos"]["Row"];
export type Mod = Database["public"]["Tables"]["mods"]["Row"];
export type ModPhoto = Database["public"]["Tables"]["mod_photos"]["Row"];
export type Render = Database["public"]["Tables"]["renders"]["Row"];
export type Like = Database["public"]["Tables"]["likes"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type ForumPost = Database["public"]["Tables"]["forum_posts"]["Row"];
export type ForumReply = Database["public"]["Tables"]["forum_replies"]["Row"];
export type ForumLike = Database["public"]["Tables"]["forum_likes"]["Row"];
export type ForumDownvote = Database["public"]["Tables"]["forum_downvotes"]["Row"];
export type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
