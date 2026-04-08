/**
 * Trait evaluation — pure functions.
 *
 * Traits are earned, not assigned. Every trait must be verifiable against
 * typed data. No randomness.
 *
 * Full list from spec:
 *   - Authenticated     — VIN verified
 *   - Builder           — 5+ fully documented mods
 *   - Respected         — avg community rating ≥ 4.0 from Builder Score 400+ users
 *   - Veteran           — 6+ months active AND 3+ cards
 *   - Specialist        — 70%+ mods in one category
 *   - Sleeper           — high performance delta on an underestimated car
 *   - Show Quality      — high photo count + high aesthetic rating
 *   - Community Pick    — top 5% in archetype within 30 days
 *   - Controversial     — high flags AND high endorsements
 */

import type { CardTrait } from "@/lib/supabase/types";

const TRAIT_DEFS: { id: string; label: string; description: string }[] = [
  { id: "authenticated",  label: "Authenticated",    description: "VIN verified against real-world NHTSA data" },
  { id: "builder",        label: "Builder",          description: "5+ mods with full documentation (cost, date, notes, photos)" },
  { id: "respected",      label: "Respected",        description: "Average community rating 4.0+ from Builder Score 400+ users" },
  { id: "veteran",        label: "Veteran",          description: "6+ months active, 3+ cards minted" },
  { id: "specialist",     label: "Specialist",       description: "70%+ of mods in a single category" },
  { id: "sleeper",        label: "Sleeper",          description: "Significant performance delta vs stock on an underestimated car" },
  { id: "show_quality",   label: "Show Quality",     description: "High photo count and strong aesthetic ratings" },
  { id: "community_pick", label: "Community Pick",   description: "Top 5% in this archetype within the last 30 days" },
  { id: "controversial",  label: "Controversial",    description: "High flag weight AND high endorsement weight — divisive build" },
];

export interface TraitInput {
  vin_verified: boolean;
  /** Mods for this specific car/build with documentation detail */
  mods: Array<{
    cost: number | null;
    install_date: string | null;
    notes: string | null;
    photo_count: number;
    category: string;
  }>;
  /** Average community rating of the card (weighted, 1–5) */
  average_rating: number | null;
  /** Whether 2+ raters with Builder Score 400+ rated this card */
  has_enough_respected_raters: boolean;
  /** Platform tenure in days (of the CARD owner) */
  owner_tenure_days: number;
  /** Total cards minted by owner */
  owner_card_count: number;
  /** HP delta vs stock */
  hp_delta: number | null;
  /** 0-60 delta vs stock (negative = faster, positive = slower) */
  zero_to_sixty_delta: number | null;
  /** Stock HP baseline */
  stock_hp: number | null;
  /** Total photo count on the car */
  photo_count: number;
  /** Average presence score (aesthetic) 1–5 */
  presence_average: number | null;
  /** Is this card top 5% in archetype within 30 days */
  is_community_pick: boolean;
  /** Endorsement weight for this specific card */
  endorsement_weight: number;
  /** Flag weight for this specific card */
  flag_weight: number;
}

export function evaluateTraits(input: TraitInput): CardTrait[] {
  const traits: CardTrait[] = [];
  const def = (id: string) => TRAIT_DEFS.find((t) => t.id === id)!;

  // Authenticated
  traits.push({
    ...def("authenticated"),
    earned: input.vin_verified,
    reason: input.vin_verified
      ? "Car VIN was verified against the NHTSA database"
      : "VIN not yet verified — add it in car details",
  });

  // Builder
  const fullyDocumented = input.mods.filter(
    (m) => m.cost != null && m.cost > 0 && m.install_date && (m.notes ?? "").trim().length >= 20 && m.photo_count >= 1,
  ).length;
  traits.push({
    ...def("builder"),
    earned: fullyDocumented >= 5,
    reason:
      fullyDocumented >= 5
        ? `${fullyDocumented} mods have full cost + date + notes + photo`
        : `${fullyDocumented}/5 mods fully documented`,
  });

  // Respected
  const respected = input.has_enough_respected_raters && (input.average_rating ?? 0) >= 4.0;
  traits.push({
    ...def("respected"),
    earned: respected,
    reason: respected
      ? `Weighted average ${(input.average_rating ?? 0).toFixed(2)}/5 from multiple respected raters`
      : input.average_rating == null
      ? "Needs ratings from Builder Score 400+ users"
      : `Avg ${(input.average_rating ?? 0).toFixed(2)}/5 — needs 4.0+ from respected raters`,
  });

  // Veteran
  const veteran = input.owner_tenure_days >= 180 && input.owner_card_count >= 3;
  traits.push({
    ...def("veteran"),
    earned: veteran,
    reason: veteran
      ? `${Math.floor(input.owner_tenure_days / 30)} months active, ${input.owner_card_count} cards minted`
      : `Needs 6+ months and 3+ cards (current: ${Math.floor(input.owner_tenure_days / 30)} months, ${input.owner_card_count} cards)`,
  });

  // Specialist
  let specialistCat: string | null = null;
  let specialistPct = 0;
  if (input.mods.length >= 3) {
    const counts: Record<string, number> = {};
    for (const m of input.mods) counts[m.category] = (counts[m.category] ?? 0) + 1;
    const [topCat, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    if (topCat) {
      specialistCat = topCat;
      specialistPct = topCount / input.mods.length;
    }
  }
  traits.push({
    ...def("specialist"),
    earned: specialistPct >= 0.7,
    reason:
      specialistCat && specialistPct >= 0.7
        ? `${Math.round(specialistPct * 100)}% of mods in ${specialistCat}`
        : specialistCat
        ? `${Math.round(specialistPct * 100)}% in ${specialistCat} — needs 70%+`
        : "Needs at least 3 mods",
  });

  // Sleeper
  // Earned if HP gain ≥ 40% and stock HP ≤ 250 (i.e. modest base that was made fast)
  const hpPct = input.hp_delta != null && input.stock_hp ? input.hp_delta / input.stock_hp : 0;
  const isSleeper = !!(input.stock_hp && input.stock_hp <= 250 && hpPct >= 0.4);
  traits.push({
    ...def("sleeper"),
    earned: isSleeper,
    reason: isSleeper
      ? `+${Math.round(hpPct * 100)}% HP over a ${input.stock_hp}hp base`
      : "Needs a modest stock HP base and significant performance delta",
  });

  // Show Quality
  const showQuality = input.photo_count >= 6 && (input.presence_average ?? 0) >= 4.0;
  traits.push({
    ...def("show_quality"),
    earned: showQuality,
    reason: showQuality
      ? `${input.photo_count} photos with ${(input.presence_average ?? 0).toFixed(2)} presence`
      : `${input.photo_count} photos — needs 6+ photos and 4.0+ presence`,
  });

  // Community Pick
  traits.push({
    ...def("community_pick"),
    earned: input.is_community_pick,
    reason: input.is_community_pick
      ? "Top 5% in archetype in the last 30 days"
      : "Not currently in the top 5% for this archetype",
  });

  // Controversial
  const controversial = input.endorsement_weight >= 5 && input.flag_weight >= 5;
  traits.push({
    ...def("controversial"),
    earned: controversial,
    reason: controversial
      ? `${input.endorsement_weight.toFixed(1)} endorsement weight vs ${input.flag_weight.toFixed(1)} flag weight`
      : `${input.endorsement_weight.toFixed(1)} endorsements, ${input.flag_weight.toFixed(1)} flags — needs both to be high`,
  });

  return traits;
}

export function earnedTraits(traits: CardTrait[]): CardTrait[] {
  return traits.filter((t) => t.earned);
}
