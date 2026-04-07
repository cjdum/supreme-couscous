/**
 * Pixel Card — shared types + constants.
 *
 * No rarity. No tiers. Cards are uniform memory snapshots.
 * Eligibility: ≥1 real photo + 72h cooldown.
 */

import type { PixelCardSnapshot } from "@/lib/supabase/types";

export const COOLDOWN_HOURS = 72;

/** Uniform card border + glow — same for every card, always. */
export const CARD_BORDER_COLOR = "#7b4fd4";
export const CARD_BORDER_GLOW  = "rgba(123,79,212,0.30)";
export const CARD_GOLD         = "#f5d76e";

// ── Era system ───────────────────────────────────────────────────────────────
export const ERAS = ["Dawn", "Chrome", "Turbo", "Neon", "Apex"] as const;
export type Era = typeof ERAS[number];

export const ERA_COLORS: Record<Era, { bg: string; text: string; border: string; glow: string }> = {
  Dawn:   { bg: "rgba(245,166,35,0.16)",  text: "#f5a623", border: "rgba(245,166,35,0.45)", glow: "rgba(245,166,35,0.25)" },
  Chrome: { bg: "rgba(192,192,208,0.13)", text: "#d0d0e0", border: "rgba(192,192,208,0.35)", glow: "rgba(192,192,208,0.2)" },
  Turbo:  { bg: "rgba(255,59,48,0.16)",   text: "#ff5c52", border: "rgba(255,59,48,0.45)",  glow: "rgba(255,59,48,0.3)" },
  Neon:   { bg: "rgba(0,255,136,0.13)",   text: "#00ff88", border: "rgba(0,255,136,0.4)",   glow: "rgba(0,255,136,0.25)" },
  Apex:   { bg: "rgba(168,85,247,0.16)",  text: "#c084fc", border: "rgba(168,85,247,0.5)",  glow: "rgba(168,85,247,0.35)" },
};

/** Pick a random era at mint time. */
export function randomEra(): Era {
  return ERAS[Math.floor(Math.random() * ERAS.length)];
}

/** Safe lookup — falls back to Chrome for unrecognized strings. */
export function safeEra(era: string | null | undefined): Era {
  return (ERAS as readonly string[]).includes(era ?? "") ? (era as Era) : "Chrome";
}

// ── MintedCard ────────────────────────────────────────────────────────────────
/** Shape of a card row from the pixel_cards table (schema v10+, v11 columns added). */
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
  /** Global sequential card number (v11). May be null on pre-v11 cards. */
  card_number: number | null;
  /** AI-generated 2-sentence poetic description (v11). */
  flavor_text: string | null;
  /** Collectible era: Dawn / Chrome / Turbo / Neon / Apex (v11). */
  era: string;
}

// ── CardEligibility ────────────────────────────────────────────────────────────
/** Eligibility response from GET /api/cards/eligibility */
export interface CardEligibility {
  eligible: boolean;
  hasPhoto: boolean;
  realPhotoCount: number;
  cooldownRemainingMs: number;
  cooldownRemainingHours: number;
  lastMintedAt: string | null;
}
