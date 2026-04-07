/**
 * Pixel Card — rarity calculation + shared types.
 * Eligibility is now checked server-side via /api/cars/[carId]/check-eligibility.
 */

// ── Rarity ──────────────────────────────────────────────────────────────────

export type PixelCardRarity = "STOCK" | "ENTHUSIAST" | "BUILDER" | "LEGEND";

export interface RarityInput {
  vinVerified: boolean;
  /** Number of installed mods that have a cost logged */
  modsWithCostCount: number;
  /** Total installed mod count */
  totalModCount: number;
  /** Description character length */
  descriptionLength: number;
}

/**
 * Data-richness rarity:
 * LEGEND     — VIN verified + 10+ costed mods + detailed description (≥120 chars)
 * BUILDER    — VIN verified + 5+ installed mods
 * ENTHUSIAST — No VIN, 5+ mods with costs logged
 * STOCK      — Everything else
 */
export function calculateRarity(input: RarityInput): PixelCardRarity {
  const { vinVerified, modsWithCostCount, totalModCount, descriptionLength } = input;

  if (vinVerified && modsWithCostCount >= 10 && descriptionLength >= 120) return "LEGEND";
  if (vinVerified && totalModCount >= 5) return "BUILDER";
  if (!vinVerified && modsWithCostCount >= 5) return "ENTHUSIAST";
  return "STOCK";
}

/** Backwards-compat shim: calculate from build score alone (used for display of old cards) */
export function calculateRarityFromScore(buildScore: number): PixelCardRarity {
  if (buildScore > 60) return "LEGEND";
  if (buildScore > 40) return "BUILDER";
  if (buildScore > 20) return "ENTHUSIAST";
  return "STOCK";
}

export const RARITY_CONFIG: Record<
  PixelCardRarity,
  { color: string; label: string; glow: string; borderColor: string }
> = {
  STOCK:      { color: "#8888aa", label: "STOCK",      glow: "rgba(136,136,170,0.30)", borderColor: "#5a5a7a" },
  ENTHUSIAST: { color: "#4a7abf", label: "ENTHUSIAST", glow: "rgba(74,122,191,0.30)",  borderColor: "#4a7abf" },
  BUILDER:    { color: "#a855f7", label: "BUILDER",    glow: "rgba(123,79,212,0.35)",  borderColor: "#7b4fd4" },
  LEGEND:     { color: "#f5d76e", label: "LEGEND",     glow: "rgba(245,215,110,0.45)", borderColor: "#f5d76e" },
};

// ── Client-side eligibility check result (returned by API) ──────────────────

export interface EligibilityCheck {
  id: "photos" | "description" | "mod_source";
  label: string;
  detail: string;
  met: boolean;
}

export interface EligibilityResponse {
  eligible: boolean;
  checks: EligibilityCheck[];
}
