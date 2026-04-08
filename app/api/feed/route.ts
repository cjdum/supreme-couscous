import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/feed?tab=for_you|new|top|battle_leaders&archetype=...
 *
 * Feed algorithm inputs:
 *   - Car similarity to viewer's garage
 *   - Recency
 *   - Card quality score (community rating + authenticity + owner BS)
 *   - Recent battle wins (small boost)
 *   - Diversity injection (every 8th card from an unseen archetype)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = (url.searchParams.get("tab") ?? "for_you") as
    | "for_you"
    | "new"
    | "top"
    | "battle_leaders";
  const archetype = url.searchParams.get("archetype");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Viewer's garage makes/models for similarity scoring
  let viewerMakes: string[] = [];
  let viewerModels: string[] = [];
  if (user) {
    const { data } = await supabase
      .from("cars")
      .select("make, model")
      .eq("user_id", user.id);
    const rows = (data ?? []) as { make: string; model: string }[];
    viewerMakes = [...new Set(rows.map((r) => r.make.toLowerCase()))];
    viewerModels = [...new Set(rows.map((r) => r.model.toLowerCase()))];
  }

  // Base query
  let q = supabase
    .from("pixel_cards")
    .select(
      "id, user_id, pixel_card_url, card_title, nickname, car_snapshot, era, rarity, card_number, occasion, minted_at, hp, mod_count, flavor_text, build_archetype, authenticity_confidence, battle_record",
    )
    .eq("is_public", true);

  if (archetype) q = q.eq("build_archetype", archetype);

  if (tab === "new") {
    q = q.order("minted_at", { ascending: false }).limit(60);
  } else if (tab === "top") {
    q = q.order("authenticity_confidence", { ascending: false, nullsFirst: false }).limit(60);
  } else if (tab === "battle_leaders") {
    // Fetched then sorted client-side by win rate (min 3 battles)
    q = q.limit(200);
  } else {
    // For You: recency window, then custom ranking below
    q = q.order("minted_at", { ascending: false }).limit(120);
  }

  const { data: cardsRaw } = await q;
  type CardRow = {
    id: string;
    user_id: string;
    pixel_card_url: string;
    card_title: string | null;
    nickname: string;
    car_snapshot: { year: number; make: string; model: string; total_invested: number | null; build_score: number | null; vin_verified: boolean; torque: number | null; zero_to_sixty: number | null; mods: string[] };
    era: string | null;
    rarity: string | null;
    card_number: number | null;
    occasion: string | null;
    minted_at: string;
    hp: number | null;
    mod_count: number | null;
    flavor_text: string | null;
    build_archetype: string | null;
    authenticity_confidence: number | null;
    battle_record: { wins: number; losses: number };
  };
  const cards = (cardsRaw ?? []) as CardRow[];

  // Owner Builder Scores (single query)
  const uniqueUserIds = [...new Set(cards.map((c) => c.user_id))];
  const bsMap = new Map<string, number>();
  if (uniqueUserIds.length > 0) {
    const { data: bsRows } = await supabase
      .from("builder_scores")
      .select("user_id, composite_score")
      .in("user_id", uniqueUserIds);
    for (const r of (bsRows ?? []) as { user_id: string; composite_score: number }[]) {
      bsMap.set(r.user_id, r.composite_score);
    }
  }

  // Score each card based on tab
  type Scored = CardRow & { _score: number };
  let ranked: Scored[];

  if (tab === "battle_leaders") {
    ranked = cards
      .filter((c) => (c.battle_record?.wins ?? 0) + (c.battle_record?.losses ?? 0) >= 3)
      .map<Scored>((c) => {
        const total = (c.battle_record?.wins ?? 0) + (c.battle_record?.losses ?? 0);
        const rate = total ? (c.battle_record?.wins ?? 0) / total : 0;
        return { ...c, _score: rate * 100 + total };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, 60);
  } else if (tab === "top") {
    ranked = cards
      .map<Scored>((c) => ({ ...c, _score: c.authenticity_confidence ?? 0 }))
      .sort((a, b) => b._score - a._score);
  } else if (tab === "new") {
    ranked = cards.map<Scored>((c) => ({ ...c, _score: new Date(c.minted_at).getTime() }));
  } else {
    // For You: custom weighted ranking
    ranked = cards.map<Scored>((c) => {
      const snap = c.car_snapshot;
      const ownerBS = bsMap.get(c.user_id) ?? 0;
      // similarity
      let similarity = 0;
      if (viewerMakes.includes(snap.make.toLowerCase())) similarity += 25;
      if (viewerModels.includes(snap.model.toLowerCase())) similarity += 20;
      // recency
      const ageDays = (Date.now() - new Date(c.minted_at).getTime()) / 86_400_000;
      const recency = Math.max(0, 25 - ageDays);
      // quality
      const quality =
        (c.authenticity_confidence ?? 50) * 0.35 +
        Math.min(100, ownerBS / 10) * 0.35 +
        (Math.min(100, (c.battle_record?.wins ?? 0) * 5));
      const score = similarity + recency + quality * 0.4;
      return { ...c, _score: score };
    });
    ranked.sort((a, b) => b._score - a._score);
  }

  // Diversity injection: every 8th card pick from an unseen archetype
  if (tab === "for_you") {
    const seenArchetypes = new Set<string>();
    const primary: Scored[] = [];
    const diverse: Scored[] = [];
    for (const c of ranked) {
      const arch = c.build_archetype ?? "unknown";
      if (seenArchetypes.has(arch) && primary.length % 8 === 7) {
        diverse.push(c);
      } else {
        primary.push(c);
        seenArchetypes.add(arch);
      }
    }
    // Interleave: every 8th slot pull from diverse
    const out: Scored[] = [];
    let di = 0;
    for (let i = 0; i < primary.length; i++) {
      out.push(primary[i]);
      if ((i + 1) % 8 === 0 && diverse[di]) out.push(diverse[di++]);
    }
    ranked = out.slice(0, 60);
  }

  // Fetch usernames
  const ownerIds = [...new Set(ranked.map((c) => c.user_id))];
  const userMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", ownerIds);
    for (const p of (data ?? []) as { user_id: string; username: string }[]) {
      userMap.set(p.user_id, p.username);
    }
  }

  const response = ranked.map((c) => ({
    ...c,
    username: userMap.get(c.user_id) ?? null,
    owner_builder_score: bsMap.get(c.user_id) ?? 0,
  }));

  return NextResponse.json({ cards: response });
}
