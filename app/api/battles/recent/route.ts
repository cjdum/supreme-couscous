import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Fetch recent battles with card titles and usernames via pixel_cards + profiles
  const { data, error } = await supabase
    .from("card_battles")
    .select("id, challenger_card_id, defender_card_id, winner_card_id, challenger_score, defender_score, battled_at")
    .order("battled_at", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ battles: [] });

  // Enrich with card titles + usernames
  const cardIds = [
    ...new Set([
      ...(data ?? []).map((b) => b.challenger_card_id),
      ...(data ?? []).map((b) => b.defender_card_id),
    ]),
  ];

  const { data: cards } = cardIds.length
    ? await supabase
        .from("pixel_cards")
        .select("id, card_title, nickname, user_id, profiles(username)")
        .in("id", cardIds)
    : { data: [] };

  type CardRow = {
    id: string;
    card_title: string | null;
    nickname: string;
    user_id: string;
    profiles: { username: string } | null;
  };
  const cardMap = new Map<string, CardRow>();
  for (const c of (cards ?? []) as unknown as CardRow[]) cardMap.set(c.id, c);

  const battles = (data ?? []).map((b) => {
    const ch = cardMap.get(b.challenger_card_id);
    const df = cardMap.get(b.defender_card_id);
    return {
      ...b,
      challenger_title: ch?.card_title ?? ch?.nickname ?? null,
      defender_title: df?.card_title ?? df?.nickname ?? null,
      challenger_username: ch?.profiles?.username ?? null,
      defender_username: df?.profiles?.username ?? null,
    };
  });

  return NextResponse.json({ battles });
}
