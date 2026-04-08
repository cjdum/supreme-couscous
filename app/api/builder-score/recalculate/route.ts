import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateBuilderScore } from "@/lib/builder-score";

/**
 * POST /api/builder-score/recalculate
 *
 * Recalculates the current user's Builder Score from scratch by pulling
 * live data (mods, cards, ratings received, signals) and writes the
 * composite + component scores to builder_scores. Called by edge function
 * hooks on relevant events (mod added, card minted, rating received, etc.)
 * and also callable manually from the profile page.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Pull all the inputs ─────────────────────────────────────────────
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const createdAt =
    (profileRaw as { created_at: string } | null)?.created_at ?? new Date().toISOString();

  // Mods + per-mod photo counts
  const { data: modsRaw } = await supabase
    .from("mods")
    .select("id, cost, install_date, notes, status")
    .eq("user_id", user.id);
  type ModRow = {
    id: string; cost: number | null; install_date: string | null; notes: string | null; status: string;
  };
  const mods = ((modsRaw ?? []) as ModRow[]).filter((m) => m.status === "installed");

  const { data: photoCountsRaw } = await supabase
    .from("mod_photos")
    .select("mod_id")
    .eq("user_id", user.id);
  const photoCounts: Record<string, number> = {};
  for (const row of (photoCountsRaw ?? []) as { mod_id: string }[]) {
    photoCounts[row.mod_id] = (photoCounts[row.mod_id] ?? 0) + 1;
  }

  // Any car VIN verified?
  const { data: carsRaw } = await supabase
    .from("cars")
    .select("vin_verified")
    .eq("user_id", user.id);
  const vinVerified = ((carsRaw ?? []) as { vin_verified: boolean }[]).some((c) => c.vin_verified);

  // Cards minted
  const { data: cardsRaw } = await supabase
    .from("pixel_cards")
    .select("id, authenticity_confidence")
    .eq("user_id", user.id);
  type CardRow = { id: string; authenticity_confidence: number | null };
  const cards = (cardsRaw ?? []) as CardRow[];

  // Endorsement & flag weight for this user's cards
  let endWeight = 0;
  let flagWeight = 0;
  if (cards.length > 0) {
    const { data: sigsRaw } = await supabase
      .from("card_credibility_signals")
      .select("signal_type, weight, card_id")
      .in("card_id", cards.map((c) => c.id));
    type Sig = { signal_type: "flag" | "endorse"; weight: number };
    for (const s of (sigsRaw ?? []) as Sig[]) {
      if (s.signal_type === "endorse") endWeight += s.weight;
      else flagWeight += s.weight;
    }
  }

  // Average received rating (across all cards)
  let avgReceived: number | null = null;
  if (cards.length > 0) {
    const { data: ratingsRaw } = await supabase
      .from("card_ratings")
      .select("weighted_composite")
      .in("card_id", cards.map((c) => c.id));
    const rows = (ratingsRaw ?? []) as { weighted_composite: number }[];
    if (rows.length > 0) {
      avgReceived = rows.reduce((s, r) => s + Number(r.weighted_composite), 0) / rows.length;
    }
  }

  // Active days in last 30 (based on mod install_date + card minted_at)
  const thirty = Date.now() - 30 * 86_400_000;
  const dayset = new Set<string>();
  for (const m of mods) {
    if (m.install_date && new Date(m.install_date).getTime() > thirty) {
      dayset.add(m.install_date);
    }
  }
  // Flag accuracy (stub: if a flag I placed matches cards that the community
  // did NOT endorse, I'm accurate. Very conservative default of 0.5 for MVP.)
  const flagAccuracy = 0.5;

  const result = calculateBuilderScore({
    mods: mods.map((m) => ({
      cost: m.cost,
      install_date: m.install_date,
      notes: m.notes,
      photo_count: photoCounts[m.id] ?? 0,
    })),
    cards: cards.map((c) => ({
      authenticity_confidence: c.authenticity_confidence,
      weighted_rating: null,
      endorsement_weight: 0,
      flag_weight: 0,
    })),
    flag_accuracy: flagAccuracy,
    created_at: createdAt,
    vin_verified: vinVerified,
    average_received_rating: avgReceived,
    active_days_30d: dayset.size,
    installed_mod_count: mods.length,
  });

  // Persist
  await supabase.from("builder_scores").upsert(
    {
      user_id: user.id,
      documentation_quality: result.documentation_quality,
      community_trust: result.community_trust,
      engagement_authenticity: result.engagement_authenticity,
      build_consistency: result.build_consistency,
      platform_tenure: result.platform_tenure,
      composite_score: result.composite_score,
      tier_label: result.tier_label,
      last_calculated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return NextResponse.json({ ok: true, builder_score: result });
}
