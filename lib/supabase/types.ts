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

export interface PixelCardSnapshot {
  make: string;
  model: string;
  year: number;
  color: string | null;
  trim: string | null;
  description: string | null;
  mods: string[];
  /** Full mod details at mint time (for card back). Optional for backward compat. */
  mods_detail?: { name: string; cost: number | null; category: string }[];
  mod_count: number;
  hp: number | null;
  torque: number | null;
  zero_to_sixty: number | null;
  total_invested: number | null;
  build_score: number | null;
  vin_verified: boolean;
  /** Stock baseline used at mint time so performance delta stays stable forever. */
  stock_hp?: number | null;
  stock_torque?: number | null;
  stock_zero_to_sixty?: number | null;
  stock_top_speed?: number | null;
}

export interface EstimatedPerformance {
  hp: number;
  torque: number;
  zero_to_sixty: number;
  top_speed: number;
}

export interface CardTrait {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  /** Why this was or was not earned. Shown in card detail. */
  reason: string;
}

export interface BattleScoreBreakdown {
  challenger: number;
  opponent: number;
  components: {
    performance: { challenger: number; opponent: number; weight: number };
    archetype: { challenger: number; opponent: number; weight: number; note: string };
    authenticity: { challenger: number; opponent: number; weight: number };
    builder_score: { challenger: number; opponent: number; weight: number };
    rng: { challenger: number; opponent: number; weight: number; seed: string };
  };
}

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
          vin_verified: boolean;
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
          vin_verified?: boolean;
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
          vin_verified?: boolean;
          updated_at?: string;
        };
      };
      pixel_cards: {
        Row: {
          id: string;
          user_id: string;
          car_id: string | null;
          car_snapshot: PixelCardSnapshot;
          pixel_card_url: string;
          nickname: string;
          hp: number | null;
          mod_count: number | null;
          minted_at: string;
          card_number: number | null;
          flavor_text: string | null;
          era: string;
          occasion: string | null;
          rarity: string;
          is_public: boolean;
          /** User-editable title (defaults to AI-generated cardTitle) */
          card_title: string | null;
          build_archetype: string | null;
          estimated_performance: EstimatedPerformance | null;
          /** Original AI estimate before any user edits (for authenticity scoring) */
          ai_estimated_performance: EstimatedPerformance | null;
          build_aggression: number | null;
          uniqueness_score: number | null;
          authenticity_confidence: number | null;
          traits: CardTrait[] | null;
          flavour_text: string | null;
          weaknesses: string[] | null;
          rival_archetypes: string[] | null;
          battle_record: { wins: number; losses: number };
          last_battle_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          car_id?: string | null;
          car_snapshot: PixelCardSnapshot;
          pixel_card_url: string;
          nickname: string;
          hp?: number | null;
          mod_count?: number | null;
          minted_at?: string;
          flavor_text?: string | null;
          era?: string;
          occasion?: string | null;
          rarity?: string;
          is_public?: boolean;
          card_title?: string | null;
          build_archetype?: string | null;
          estimated_performance?: EstimatedPerformance | null;
          ai_estimated_performance?: EstimatedPerformance | null;
          build_aggression?: number | null;
          uniqueness_score?: number | null;
          authenticity_confidence?: number | null;
          traits?: CardTrait[] | null;
          flavour_text?: string | null;
          weaknesses?: string[] | null;
          rival_archetypes?: string[] | null;
          battle_record?: { wins: number; losses: number };
        };
        Update: {
          car_id?: string | null;
          nickname?: string;
          flavor_text?: string | null;
          era?: string;
          occasion?: string | null;
          rarity?: string;
          is_public?: boolean;
          card_title?: string | null;
          build_archetype?: string | null;
          estimated_performance?: EstimatedPerformance | null;
          build_aggression?: number | null;
          uniqueness_score?: number | null;
          authenticity_confidence?: number | null;
          traits?: CardTrait[] | null;
          flavour_text?: string | null;
          weaknesses?: string[] | null;
          rival_archetypes?: string[] | null;
          battle_record?: { wins: number; losses: number };
          last_battle_at?: string | null;
        };
      };
      builder_scores: {
        Row: {
          user_id: string;
          documentation_quality: number;
          community_trust: number;
          engagement_authenticity: number;
          build_consistency: number;
          platform_tenure: number;
          composite_score: number;
          tier_label: string;
          last_calculated_at: string;
        };
        Insert: {
          user_id: string;
          documentation_quality?: number;
          community_trust?: number;
          engagement_authenticity?: number;
          build_consistency?: number;
          platform_tenure?: number;
          composite_score?: number;
          tier_label?: string;
          last_calculated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["builder_scores"]["Insert"]>;
      };
      card_ratings: {
        Row: {
          id: string;
          card_id: string;
          rater_id: string;
          rater_builder_score_at_time: number;
          cleanliness: number;
          creativity: number;
          execution: number;
          presence: number;
          weighted_composite: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          rater_id: string;
          rater_builder_score_at_time?: number;
          cleanliness: number;
          creativity: number;
          execution: number;
          presence: number;
          weighted_composite?: number;
        };
        Update: {
          cleanliness?: number;
          creativity?: number;
          execution?: number;
          presence?: number;
          weighted_composite?: number;
        };
      };
      card_battles: {
        Row: {
          id: string;
          challenger_card_id: string;
          opponent_card_id: string;
          challenger_user_id: string;
          opponent_user_id: string;
          outcome: "win" | "loss" | "narrow_win" | "narrow_loss";
          score_breakdown: BattleScoreBreakdown;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenger_card_id: string;
          opponent_card_id: string;
          challenger_user_id: string;
          opponent_user_id: string;
          outcome: "win" | "loss" | "narrow_win" | "narrow_loss";
          score_breakdown: BattleScoreBreakdown;
        };
        Update: never;
      };
      card_credibility_signals: {
        Row: {
          id: string;
          card_id: string;
          user_id: string;
          signal_type: "flag" | "endorse";
          weight: number;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          user_id: string;
          signal_type: "flag" | "endorse";
          weight?: number;
          reason?: string | null;
        };
        Update: never;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          payload: Record<string, unknown>;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          payload?: Record<string, unknown>;
          read?: boolean;
        };
        Update: {
          read?: boolean;
        };
      };
      achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_type: string;
          category: "builder" | "community" | "battle" | "platform";
          earned_at: string;
          progress_data: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_type: string;
          category: "builder" | "community" | "battle" | "platform";
          progress_data?: Record<string, unknown>;
        };
        Update: {
          progress_data?: Record<string, unknown>;
        };
      };
      vehicle_stock_specs: {
        Row: {
          id: string;
          year: number;
          make: string;
          model: string;
          trim: string | null;
          hp: number | null;
          torque: number | null;
          zero_to_sixty: number | null;
          top_speed: number | null;
          weight: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          make: string;
          model: string;
          trim?: string | null;
          hp?: number | null;
          torque?: number | null;
          zero_to_sixty?: number | null;
          top_speed?: number | null;
          weight?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vehicle_stock_specs"]["Insert"]>;
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
export type PixelCard = Database["public"]["Tables"]["pixel_cards"]["Row"];
export type BuilderScore = Database["public"]["Tables"]["builder_scores"]["Row"];
export type CardRating = Database["public"]["Tables"]["card_ratings"]["Row"];
export type CardBattle = Database["public"]["Tables"]["card_battles"]["Row"];
export type CardCredibilitySignal = Database["public"]["Tables"]["card_credibility_signals"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type Achievement = Database["public"]["Tables"]["achievements"]["Row"];
export type VehicleStockSpec = Database["public"]["Tables"]["vehicle_stock_specs"]["Row"];
