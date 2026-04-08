/**
 * Pixel Card — shared types + constants.
 *
 * Rarity tiers: Common / Uncommon / Rare / Ultra Rare / Legendary
 * Eligibility: ≥1 real photo. No cooldown.
 */

import type { PixelCardSnapshot } from "@/lib/supabase/types";

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

// ── Rarity system ─────────────────────────────────────────────────────────────
export const RARITIES = ["Common", "Uncommon", "Rare", "Ultra Rare", "Legendary"] as const;
export type Rarity = typeof RARITIES[number];

export const RARITY_COLORS: Record<Rarity, { bg: string; text: string; border: string; glow: string }> = {
  Common:       { bg: "rgba(160,160,160,0.10)", text: "#9ca3af", border: "rgba(160,160,160,0.28)", glow: "rgba(160,160,160,0.12)" },
  Uncommon:     { bg: "rgba(48,209,88,0.12)",   text: "#30d158", border: "rgba(48,209,88,0.35)",   glow: "rgba(48,209,88,0.20)" },
  Rare:         { bg: "rgba(59,130,246,0.14)",  text: "#60a5fa", border: "rgba(59,130,246,0.40)",  glow: "rgba(59,130,246,0.25)" },
  "Ultra Rare": { bg: "rgba(168,85,247,0.16)",  text: "#c084fc", border: "rgba(168,85,247,0.50)", glow: "rgba(168,85,247,0.35)" },
  Legendary:    { bg: "rgba(245,215,110,0.18)", text: "#f5d76e", border: "rgba(245,215,110,0.55)", glow: "rgba(245,215,110,0.40)" },
};

/**
 * Assign rarity at mint time based on mod count, total invested, build score,
 * and a small random factor. Called server-side during minting.
 *
 * @param modCount      Number of installed mods at mint time
 * @param totalInvested Total $ invested across all installed mods
 * @param buildScore    Current build score (or null)
 * @param randomFactor  A value 0–1 (Math.random()) for small variance
 */
export function assignRarity(
  modCount: number,
  totalInvested: number,
  buildScore: number | null,
  randomFactor: number,
): Rarity {
  let score = 0;

  // Mod count (max 4)
  if (modCount >= 20) score += 4;
  else if (modCount >= 10) score += 3;
  else if (modCount >= 5) score += 2;
  else if (modCount >= 2) score += 1;

  // Total invested (max 4)
  if (totalInvested >= 20000) score += 4;
  else if (totalInvested >= 10000) score += 3;
  else if (totalInvested >= 5000) score += 2;
  else if (totalInvested >= 1000) score += 1;

  // Build score (max 4)
  const bs = buildScore ?? 0;
  if (bs >= 800) score += 4;
  else if (bs >= 400) score += 3;
  else if (bs >= 150) score += 2;
  else if (bs >= 50) score += 1;

  // Random luck (max 3): 5% get +3, 20% get +1
  if (randomFactor > 0.95) score += 3;
  else if (randomFactor > 0.75) score += 1;

  // Map total (0–15) to tier
  if (score >= 12) return "Legendary";
  if (score >= 9)  return "Ultra Rare";
  if (score >= 6)  return "Rare";
  if (score >= 3)  return "Uncommon";
  return "Common";
}

/** Safe rarity lookup — falls back to Common for unknown strings. */
export function safeRarity(rarity: string | null | undefined): Rarity {
  return (RARITIES as readonly string[]).includes(rarity ?? "") ? (rarity as Rarity) : "Common";
}

// ── MintedCard ────────────────────────────────────────────────────────────────
/** Shape of a card row from the pixel_cards table. */
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
  card_number: number | null;
  flavor_text: string | null;
  era: string;
  occasion: string | null;
  /** Rarity tier (v13): Common / Uncommon / Rare / Ultra Rare / Legendary */
  rarity: string;
  /** Whether card appears in the public community feed (v13). Default true. */
  is_public: boolean;
}

// ── CardEligibility ────────────────────────────────────────────────────────────
export interface CardEligibility {
  eligible: boolean;
  hasPhoto: boolean;
  realPhotoCount: number;
}
