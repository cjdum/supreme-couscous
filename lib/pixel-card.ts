/**
 * Pixel Card — shared types.
 *
 * No rarity. No tiers. Cards are uniform memory snapshots.
 * Eligibility is the simplest possible: ≥1 photo + 72h cooldown.
 */

import type { PixelCardSnapshot } from "@/lib/supabase/types";

export const COOLDOWN_HOURS = 72;

/** Uniform card border + glow — same for every card, always. */
export const CARD_BORDER_COLOR  = "#7b4fd4";
export const CARD_BORDER_GLOW   = "rgba(123,79,212,0.30)";
export const CARD_GOLD          = "#f5d76e";

/** Shape of a card row from the pixel_cards table */
export interface MintedCard {
  id: string;
  user_id: string;
  car_id: string | null;
  car_snapshot: PixelCardSnapshot;
  pixel_card_url: string;
  nickname: string;
  hp: number | null;
  mod_count: number | null;
  minted_at: string;
}

/** Eligibility response from /api/cards/eligibility */
export interface CardEligibility {
  eligible: boolean;
  hasPhoto: boolean;
  realPhotoCount: number;
  cooldownRemainingMs: number;
  cooldownRemainingHours: number;
  lastMintedAt: string | null;
}
