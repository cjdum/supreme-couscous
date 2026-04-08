import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("card_battles")
    .select("id, challenger_card_id, opponent_card_id, outcome, score_breakdown, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ battles: [] });

  // Enrich with card titles + usernames
  const cardIds = [
    ...new Set([
      ...(data ?? []).map((b) => b.challenger_card_id),
      ...(data ?? []).map((b) => b.opponent_card_id),
    ]),
  ];

  const { data: cards } = cardIds.length
    ? await supabase
        .from("pixel_cards")
        .select("id, card_title, nickname, user_id")
        .in("id", cardIds)
    : { data: [] };

  type CardRow = { id: string; card_title: string | null; nickname: string; user_id: string };
  const cardMap = new Map<string, CardRow>();
  for (const c of (cards ?? []) as unknown as CardRow[]) cardMap.set(c.id, c);

  // Pull usernames
  const userIds = [...new Set([...cardMap.values()].map((c) => c.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id, username").in("user_id", userIds)
    : { data: [] };
  type Prof = { user_id: string; username: string };
  const profMap = new Map<string, string>();
  for (const p of (profiles ?? []) as unknown as Prof[]) profMap.set(p.user_id, p.username);

  type BattleRow = {
    id: string;
    challenger_card_id: string;
    opponent_card_id: string;
    outcome: string;
    score_breakdown: { challenger: number; opponent: number } | null;
    created_at: string;
  };

  const battles = (data ?? []).map((b) => {
    const raw = b as unknown as BattleRow;
    const ch  = cardMap.get(raw.challenger_card_id);
    const op  = cardMap.get(raw.opponent_card_id);
    const chWins = raw.outcome === "win" || raw.outcome === "narrow_win";
    return {
      id:                   raw.id,
      challenger_card_id:   raw.challenger_card_id,
      defender_card_id:     raw.opponent_card_id,
      winner_card_id:       chWins ? raw.challenger_card_id : raw.opponent_card_id,
      challenger_score:     raw.score_breakdown?.challenger ?? 0,
      defender_score:       raw.score_breakdown?.opponent ?? 0,
      battled_at:           raw.created_at,
      challenger_title:     ch?.card_title ?? ch?.nickname ?? null,
      defender_title:       op?.card_title ?? op?.nickname ?? null,
      challenger_username:  ch ? profMap.get(ch.user_id) ?? null : null,
      defender_username:    op ? profMap.get(op.user_id) ?? null : null,
    };
  });

  return NextResponse.json({ battles });
}
