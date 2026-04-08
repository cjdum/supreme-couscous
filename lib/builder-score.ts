/**
 * Builder Score — per-user credibility rating (0–1000).
 *
 * Components and weights (per spec):
 *   - documentation_quality    25%
 *   - community_trust          25%
 *   - engagement_authenticity  20%
 *   - build_consistency        15%
 *   - platform_tenure          15%
 *
 * Tiers:
 *   Newcomer    0–199
 *   Enthusiast  200–399
 *   Builder     400–599
 *   Respected   600–799
 *   Authority   800–999
 *   Legend      1000
 *
 * Pure functions — no side effects. The recalc endpoint pulls raw data and
 * calls calculateBuilderScore().
 */

export interface BuilderScoreTier {
  label: string;
  min: number;
  max: number;
  color: string;
  description: string;
}

export const BUILDER_SCORE_TIERS: BuilderScoreTier[] = [
  { label: "Newcomer",   min: 0,    max: 199,  color: "#8a8a8a", description: "Finding your footing" },
  { label: "Enthusiast", min: 200,  max: 399,  color: "#60a5fa", description: "Real passion taking shape" },
  { label: "Builder",    min: 400,  max: 599,  color: "#30d158", description: "A legitimate voice in the community" },
  { label: "Respected",  min: 600,  max: 799,  color: "#a855f7", description: "Others reference your takes" },
  { label: "Authority",  min: 800,  max: 999,  color: "#fbbf24", description: "Your endorsements carry weight" },
  { label: "Legend",     min: 1000, max: 1000, color: "#f5d76e", description: "A fixture of the platform" },
];

export function tierFor(score: number): BuilderScoreTier {
  for (const t of BUILDER_SCORE_TIERS) {
    if (score >= t.min && score <= t.max) return t;
  }
  return BUILDER_SCORE_TIERS[0];
}

/** Weight-normalised component (0–100) applied to its percentage allocation. */
function weighted(component: number, weightPct: number): number {
  return Math.round((component / 100) * weightPct * 10);
}

export interface BuilderScoreInput {
  /** Mods with rich metadata — cost, date, notes, photos count */
  mods: Array<{
    cost: number | null;
    install_date: string | null;
    notes: string | null;
    photo_count: number;
  }>;
  /** Cards minted by this user */
  cards: Array<{
    authenticity_confidence: number | null;
    weighted_rating: number | null;
    endorsement_weight: number;
    flag_weight: number;
  }>;
  /** Any public flagging this user has done that was later overturned by high-builder-score endorsements. */
  flag_accuracy: number; // 0..1
  /** Account creation ISO timestamp */
  created_at: string;
  /** VIN verified */
  vin_verified: boolean;
  /** Community ratings received on the user's cards (average of cleanliness/creativity/execution/presence). */
  average_received_rating: number | null;
  /** Days active in the last 30 */
  active_days_30d: number;
  /** Total installed mods */
  installed_mod_count: number;
}

export interface BuilderScoreResult {
  documentation_quality: number;
  community_trust: number;
  engagement_authenticity: number;
  build_consistency: number;
  platform_tenure: number;
  composite_score: number;
  tier_label: string;
  tier_color: string;
  tier_description: string;
  breakdown: {
    component: string;
    weight: number;
    raw: number;
    contribution: number;
    notes: string[];
  }[];
}

export function calculateBuilderScore(input: BuilderScoreInput): BuilderScoreResult {
  const breakdown: BuilderScoreResult["breakdown"] = [];

  // ── Documentation quality (25%) ───────────────────────────────────────────
  // Reward: costs logged, install dates, notes, photos per mod.
  let docRaw = 0;
  const docNotes: string[] = [];
  if (input.mods.length > 0) {
    const withCost = input.mods.filter((m) => m.cost != null && m.cost > 0).length;
    const withDate = input.mods.filter((m) => m.install_date).length;
    const withNotes = input.mods.filter((m) => m.notes && m.notes.trim().length >= 20).length;
    const withPhotos = input.mods.filter((m) => m.photo_count >= 1).length;
    const avg = (withCost + withDate + withNotes + withPhotos) / (input.mods.length * 4);
    docRaw = Math.round(avg * 100);
    docNotes.push(`${withCost}/${input.mods.length} mods have cost`);
    docNotes.push(`${withDate}/${input.mods.length} mods have install date`);
    docNotes.push(`${withNotes}/${input.mods.length} mods have substantive notes`);
    docNotes.push(`${withPhotos}/${input.mods.length} mods have photos`);
    if (input.vin_verified) {
      docRaw = Math.min(100, docRaw + 8);
      docNotes.push("VIN verified (+8)");
    }
  }
  breakdown.push({ component: "Documentation quality", weight: 25, raw: docRaw, contribution: weighted(docRaw, 25), notes: docNotes });

  // ── Community trust (25%) ─────────────────────────────────────────────────
  // Weighted average card rating + endorsement/flag balance across own cards.
  let ctRaw = 0;
  const ctNotes: string[] = [];
  if (input.cards.length > 0) {
    const avgAuth = input.cards.reduce((s, c) => s + (c.authenticity_confidence ?? 50), 0) / input.cards.length;
    const avgRating = input.cards.reduce((s, c) => s + (c.weighted_rating ?? 0), 0) / input.cards.length;
    const endWeight = input.cards.reduce((s, c) => s + c.endorsement_weight, 0);
    const flagWeight = input.cards.reduce((s, c) => s + c.flag_weight, 0);
    const netSignal = Math.max(0, Math.min(100, 50 + (endWeight - flagWeight) * 5));
    ctRaw = Math.round(avgAuth * 0.4 + (avgRating / 5) * 100 * 0.4 + netSignal * 0.2);
    ctNotes.push(`Avg card authenticity: ${Math.round(avgAuth)}%`);
    ctNotes.push(`Avg weighted rating: ${avgRating.toFixed(2)}/5`);
    ctNotes.push(`Net endorse - flag weight: ${(endWeight - flagWeight).toFixed(1)}`);
  } else {
    ctNotes.push("No cards minted yet");
  }
  if (input.average_received_rating != null && input.average_received_rating >= 4) {
    ctRaw = Math.min(100, ctRaw + 10);
    ctNotes.push(`Average received rating ≥ 4.0 (+10)`);
  }
  breakdown.push({ component: "Community trust", weight: 25, raw: ctRaw, contribution: weighted(ctRaw, 25), notes: ctNotes });

  // ── Engagement authenticity (20%) ─────────────────────────────────────────
  // Flag accuracy + rating participation without self-promotion.
  const eaRaw = Math.round(input.flag_accuracy * 100);
  breakdown.push({
    component: "Engagement authenticity",
    weight: 20,
    raw: eaRaw,
    contribution: weighted(eaRaw, 20),
    notes: [`Flag accuracy: ${Math.round(input.flag_accuracy * 100)}%`],
  });

  // ── Build consistency (15%) ───────────────────────────────────────────────
  // Steady logging cadence rather than dumps.
  let bcRaw = 0;
  const bcNotes: string[] = [];
  if (input.installed_mod_count >= 3 && input.active_days_30d >= 3) {
    bcRaw = Math.min(100, 30 + input.active_days_30d * 2 + Math.min(input.installed_mod_count, 20) * 2);
    bcNotes.push(`${input.active_days_30d} active days / 30`);
    bcNotes.push(`${input.installed_mod_count} installed mods`);
  } else {
    bcNotes.push("Needs 3+ installed mods and 3+ active days");
  }
  breakdown.push({ component: "Build consistency", weight: 15, raw: bcRaw, contribution: weighted(bcRaw, 15), notes: bcNotes });

  // ── Platform tenure (15%) ─────────────────────────────────────────────────
  const ageMs = Date.now() - new Date(input.created_at).getTime();
  const ageDays = Math.floor(ageMs / 86_400_000);
  let ptRaw = 0;
  if (ageDays >= 365) ptRaw = 100;
  else if (ageDays >= 180) ptRaw = 70;
  else if (ageDays >= 90) ptRaw = 45;
  else if (ageDays >= 30) ptRaw = 20;
  else if (ageDays >= 7) ptRaw = 8;
  breakdown.push({
    component: "Platform tenure",
    weight: 15,
    raw: ptRaw,
    contribution: weighted(ptRaw, 15),
    notes: [`${ageDays} days on platform`],
  });

  const composite = breakdown.reduce((s, b) => s + b.contribution, 0);
  const tier = tierFor(composite);

  return {
    documentation_quality: docRaw,
    community_trust: ctRaw,
    engagement_authenticity: eaRaw,
    build_consistency: bcRaw,
    platform_tenure: ptRaw,
    composite_score: Math.max(0, Math.min(1000, composite)),
    tier_label: tier.label,
    tier_color: tier.color,
    tier_description: tier.description,
    breakdown,
  };
}

/**
 * Rating weight multiplier based on rater's Builder Score tier.
 *
 * Newcomer 0.5x
 * Enthusiast 0.75x
 * Builder 1.0x
 * Respected 1.5x
 * Authority 2.0x
 * Legend 3.0x
 */
export function raterWeight(builderScore: number): number {
  if (builderScore >= 1000) return 3.0;
  if (builderScore >= 800) return 2.0;
  if (builderScore >= 600) return 1.5;
  if (builderScore >= 400) return 1.0;
  if (builderScore >= 200) return 0.75;
  return 0.5;
}

/**
 * Flag/endorse signal weight. Sub-200 Builder Score flags count at 25%
 * per spec — a soft floor so noise from brand-new accounts can't tank
 * legitimate builds.
 */
export function signalWeight(builderScore: number, signalType: "flag" | "endorse"): number {
  if (signalType === "flag" && builderScore < 200) return 0.25;
  // Otherwise scale linearly with tier multiplier.
  return raterWeight(builderScore);
}
