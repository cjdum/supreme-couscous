import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCardLine } from "@/lib/card-lines";

/**
 * POST /api/card-poke
 * Returns a personality-based line from the database card record.
 * Does NOT call Claude — instant, from pre-written lines.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { card_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { card_id } = body;
  if (!card_id) return NextResponse.json({ error: "card_id required" }, { status: 400 });

  const { data: card } = await supabase
    .from("pixel_cards")
    .select("personality, nickname")
    .eq("id", card_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  const line = getCardLine(card.personality);
  return NextResponse.json({ line, personality: card.personality });
}
