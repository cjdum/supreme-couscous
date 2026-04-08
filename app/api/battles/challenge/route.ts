import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, API_RATE_LIMIT } from "@/lib/rate-limit";
import type { BattleScoreBreakdown, EstimatedPerformance } from "@/lib/supabase/types";

/**
 * POST /api/battles/challenge
 *
 * Resolve a battle between challenger_card and opponent_card.
 *
 * Outcome formula:
 *   - Derived performance score:       35%
 *   - Archetype matchup:                20% (Track beats Street, Show loses perf matchups, etc.)
 *   - Authenticity confidence:          20%
 *   - Builder Score delta:              15%
 *   - Seeded RNG:                       10%
 *
 * Hard rules:
 *   - Cards with authenticityConfidence < 30 cannot initiate battles
 *   - 24h cooldown per card (checked against last_battle_at)
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`battles:${user.id}`, API_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: "Slow down" }, { status: 429 });

  let body: { challenger_card_id?: string; opponent_card_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { challenger_card_id, opponent_card_id } = body;
  if (!challenger_card_id || !opponent_card_id) {
    return NextResponse.json({ error: "Both card IDs required" }, { status: 400 });
  }
  if (challenger_card_id === opponent_card_id) {
    return NextResponse.json({ error: "Cannot battle a card against itself" }, { status: 400 });
  }

  const { data: cardsRaw, error: cardsErr } = await supabase
    .from("pixel_cards")
    .select(
      "id, user_id, build_archetype, estimated_performance, authenticity_confidence, last_battle_at, battle_record",
    )
    .in("id", [challenger_card_id, opponent_card_id]);
  if (cardsErr) return NextResponse.json({ error: cardsErr.message }, { status: 500 });

  type CardRow = {
    id: string;
    user_id: string;
    build_archetype: string | null;
    estimated_performance: EstimatedPerformance | null;
    authenticity_confidence: number | null;
    last_battle_at: string | null;
    battle_record: { wins: number; losses: number };
  };
  const cards = (cardsRaw ?? []) as CardRow[];
  const challenger = cards.find((c) => c.id === challenger_card_id);
  const opponent = cards.find((c) => c.id === opponent_card_id);
  if (!challenger || !opponent) {
    return NextResponse.json({ error: "Cards not found" }, { status: 404 });
  }

  // Must own the challenger card
  if (challenger.user_id !== user.id) {
    return NextResponse.json({ error: "You don't own that card" }, { status: 403 });
  }
  // No self-battle
  if (opponent.user_id === user.id) {
    return NextResponse.json({ error: "Cannot battle yourself" }, { status: 400 });
  }

  // Authenticity gate
  if ((challenger.authenticity_confidence ?? 0) < 30) {
    return NextResponse.json(
      { error: "Challenger card authenticity is too low to battle" },
      { status: 403 },
    );
  }

  // 24h cooldown on challenger
  if (challenger.last_battle_at) {
    const ms = Date.now() - new Date(challenger.last_battle_at).getTime();
    if (ms < 24 * 3600 * 1000) {
      const hoursLeft = Math.ceil((24 * 3600 * 1000 - ms) / 3600 / 1000);
      return NextResponse.json(
        { error: `Cooldown: try again in ${hoursLeft}h` },
        { status: 429 },
      );
    }
  }

  // Pull Builder Scores
  const { data: bsRows } = await supabase
    .from("builder_scores")
    .select("user_id, composite_score")
    .in("user_id", [challenger.user_id, opponent.user_id]);
  type BS = { user_id: string; composite_score: number };
  const bsMap = new Map<string, number>();
  for (const r of (bsRows ?? []) as BS[]) bsMap.set(r.user_id, r.composite_score);
  const cBS = bsMap.get(challenger.user_id) ?? 0;
  const oBS = bsMap.get(opponent.user_id) ?? 0;

  // ── Component 1: performance (35%) ────────────────────────────────────
  const cPerf = challenger.estimated_performance ?? { hp: 250, torque: 250, zero_to_sixty: 6, top_speed: 150 };
  const oPerf = opponent.estimated_performance ?? { hp: 250, torque: 250, zero_to_sixty: 6, top_speed: 150 };
  const perfC =
    (cPerf.hp / 10) + (cPerf.torque / 12) + (160 - cPerf.top_speed * -1) / 4 + (10 - cPerf.zero_to_sixty) * 8;
  const perfO =
    (oPerf.hp / 10) + (oPerf.torque / 12) + (160 - oPerf.top_speed * -1) / 4 + (10 - oPerf.zero_to_sixty) * 8;

  // ── Component 2: archetype matchup (20%) ──────────────────────────────
  const { challengerBonus, opponentBonus, note } = archetypeMatchup(
    challenger.build_archetype ?? "Daily Driven",
    opponent.build_archetype ?? "Daily Driven",
  );
  const archC = 50 + challengerBonus;
  const archO = 50 + opponentBonus;

  // ── Component 3: authenticity (20%) ───────────────────────────────────
  const authC = challenger.authenticity_confidence ?? 50;
  const authO = opponent.authenticity_confidence ?? 50;

  // ── Component 4: Builder Score delta (15%) ────────────────────────────
  const bsDeltaC = Math.max(0, Math.min(100, 50 + (cBS - oBS) / 20));
  const bsDeltaO = 100 - bsDeltaC;

  // ── Component 5: seeded RNG (10%) ─────────────────────────────────────
  const seed = `${challenger_card_id}:${opponent_card_id}:${Math.floor(Date.now() / 1000 / 3600)}`;
  const rngC = seededFloat(seed) * 100;
  const rngO = seededFloat(seed + "#o") * 100;

  // Weighted composite
  const scoreC =
    perfC * 0.35 +
    archC * 0.2 +
    authC * 0.2 +
    bsDeltaC * 0.15 +
    rngC * 0.1;
  const scoreO =
    perfO * 0.35 +
    archO * 0.2 +
    authO * 0.2 +
    bsDeltaO * 0.15 +
    rngO * 0.1;

  const margin = scoreC - scoreO;
  let outcome: "win" | "loss" | "narrow_win" | "narrow_loss";
  if (margin > 5) outcome = "win";
  else if (margin > 0) outcome = "narrow_win";
  else if (margin > -5) outcome = "narrow_loss";
  else outcome = "loss";

  const breakdown: BattleScoreBreakdown = {
    challenger: Math.round(scoreC * 10) / 10,
    opponent: Math.round(scoreO * 10) / 10,
    components: {
      performance:   { challenger: Math.round(perfC), opponent: Math.round(perfO), weight: 0.35 },
      archetype:     { challenger: archC, opponent: archO, weight: 0.2, note },
      authenticity:  { challenger: authC, opponent: authO, weight: 0.2 },
      builder_score: { challenger: Math.round(bsDeltaC), opponent: Math.round(bsDeltaO), weight: 0.15 },
      rng:           { challenger: Math.round(rngC), opponent: Math.round(rngO), weight: 0.1, seed },
    },
  };

  const now = new Date().toISOString();

  // Persist battle + update records
  await supabase.from("card_battles").insert({
    challenger_card_id,
    opponent_card_id,
    challenger_user_id: challenger.user_id,
    opponent_user_id: opponent.user_id,
    outcome,
    score_breakdown: breakdown,
  });

  // Update both cards' records + last_battle_at
  const chalWin = outcome === "win" || outcome === "narrow_win";
  await supabase
    .from("pixel_cards")
    .update({
      last_battle_at: now,
      battle_record: {
        wins: (challenger.battle_record?.wins ?? 0) + (chalWin ? 1 : 0),
        losses: (challenger.battle_record?.losses ?? 0) + (chalWin ? 0 : 1),
      },
    })
    .eq("id", challenger_card_id);

  await supabase
    .from("pixel_cards")
    .update({
      last_battle_at: now,
      battle_record: {
        wins: (opponent.battle_record?.wins ?? 0) + (chalWin ? 0 : 1),
        losses: (opponent.battle_record?.losses ?? 0) + (chalWin ? 1 : 0),
      },
    })
    .eq("id", opponent_card_id);

  // Notifications to both users
  await supabase
    .from("notifications")
    .insert([
      {
        user_id: challenger.user_id,
        type: "battle_result",
        payload: { outcome, breakdown, card_id: challenger_card_id, opponent_card_id },
      },
      {
        user_id: opponent.user_id,
        type: "battle_challenge",
        payload: { outcome: chalWin ? "loss" : "win", breakdown, card_id: opponent_card_id, challenger_card_id },
      },
    ])
    .then(() => {}, () => {});

  return NextResponse.json({ outcome, breakdown });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function seededFloat(seed: string): number {
  // Simple deterministic float in [0, 1) — xorshift of a string hash
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h << 13; h >>>= 0;
  h ^= h >>> 17; h >>>= 0;
  h ^= h << 5;  h >>>= 0;
  return (h % 10000) / 10000;
}

function archetypeMatchup(
  challenger: string,
  opponent: string,
): { challengerBonus: number; opponentBonus: number; note: string } {
  const PERF = new Set(["Track Weapon", "Time Attack", "Street Brawler", "Sleeper", "Drift Build"]);
  const SHOW = new Set(["Show Stopper", "Stance Build", "Show & Go"]);
  const STREET = new Set(["Street Brawler", "Daily Driven", "Grand Tourer", "Cruiser"]);
  const TRACK = new Set(["Track Weapon", "Time Attack"]);

  if (TRACK.has(challenger) && STREET.has(opponent)) {
    return { challengerBonus: 15, opponentBonus: -10, note: "Track beats Street" };
  }
  if (STREET.has(challenger) && TRACK.has(opponent)) {
    return { challengerBonus: -10, opponentBonus: 15, note: "Street loses to Track" };
  }
  if (SHOW.has(challenger) && PERF.has(opponent)) {
    return { challengerBonus: -15, opponentBonus: 10, note: "Show loses performance matchups" };
  }
  if (PERF.has(challenger) && SHOW.has(opponent)) {
    return { challengerBonus: 10, opponentBonus: -15, note: "Performance beats Show" };
  }
  if (challenger === "Sleeper" && opponent !== "Sleeper") {
    return { challengerBonus: 8, opponentBonus: 0, note: "Sleeper surprise bonus" };
  }
  return { challengerBonus: 0, opponentBonus: 0, note: "Even matchup" };
}
