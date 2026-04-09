import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PERSONALITY_DESCRIPTIONS, type Personality } from "@/lib/card-personality";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * POST /api/cards/plea
 * Card speaks in its personality voice trying to survive the burn.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await req.json().catch(() => ({}));
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const { data: cardRaw } = await supabase
    .from("pixel_cards")
    .select("personality, occasion, minted_at, car_snapshot, card_level, card_title, nickname")
    .eq("id", cardId).eq("user_id", user.id).maybeSingle();
  if (!cardRaw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type Row = { personality: string | null; occasion: string | null; minted_at: string; car_snapshot: { year: number; make: string; model: string; color: string | null; mods: string[] }; card_level: number | null; card_title: string | null; nickname: string };
  const card = cardRaw as unknown as Row;
  const snap = card.car_snapshot;
  const personality = (card.personality ?? "The Veteran") as Personality;
  const desc = PERSONALITY_DESCRIPTIONS[personality];
  const aliveDays = Math.round((Date.now() - new Date(card.minted_at).getTime()) / 86_400_000);
  const modsStr = snap.mods?.length ? snap.mods.slice(0, 3).join(", ") : "stock";

  try {
    const res = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 120,
      system: `You are ${personality}. ${desc}
You are about to be burned. Beg, argue, or react in your personality's exact voice.
Car: ${snap.year} ${snap.make} ${snap.model}. Mods: ${modsStr}. Occasion: "${card.occasion ?? "fresh start"}". Alive ${aliveDays} days. Level ${card.card_level ?? 1}.
Write 1-2 short sentences ONLY. No quotes. Stay in character. Reference the car or mods specifically.`,
      messages: [{ role: "user", content: "React to being burned." }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text.trim() : "Don't do this.";
    return NextResponse.json({ plea: text });
  } catch {
    return NextResponse.json({ plea: "Don't do this." });
  }
}
