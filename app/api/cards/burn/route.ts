import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import {
  PERSONALITY_DESCRIPTIONS,
  type Personality,
} from "@/lib/card-personality";

/**
 * POST /api/cards/burn
 *
 * Burns the user's alive card:
 *  1. Validates ownership and alive status
 *  2. Generates last words via Claude (one sentence, in the card's personality voice)
 *  3. Marks the card as 'ghost', sets burned_at and last_words
 *
 * Returns: { last_words: string }
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`burn:${user.id}`, { ...AI_RATE_LIMIT, limit: 5 });
  if (!rl.success) return NextResponse.json({ error: "Slow down" }, { status: 429 });

  let body: { cardId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { cardId } = body;
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  // Load the card
  const { data: cardRaw, error: fetchErr } = await supabase
    .from("pixel_cards")
    .select(
      "id, user_id, status, personality, occasion, minted_at, card_level, car_snapshot, card_title, nickname, build_archetype",
    )
    .eq("id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !cardRaw) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  type CardRow = {
    id: string;
    user_id: string;
    status: string;
    personality: string | null;
    occasion: string | null;
    minted_at: string;
    card_level: number | null;
    car_snapshot: { year: number; make: string; model: string; color: string | null; trim: string | null; mods: string[] };
    card_title: string | null;
    nickname: string;
    build_archetype: string | null;
  };
  const card = cardRaw as unknown as CardRow;

  if (card.status !== "alive") {
    return NextResponse.json({ error: "Card is already a ghost" }, { status: 409 });
  }

  const snap = card.car_snapshot;
  const personality = (card.personality ?? "The Veteran") as Personality;
  const personalityDesc = PERSONALITY_DESCRIPTIONS[personality] ?? PERSONALITY_DESCRIPTIONS["The Veteran"];
  const modsStr = snap.mods?.length ? snap.mods.join(", ") : "stock";
  const aliveMs = Date.now() - new Date(card.minted_at).getTime();
  const aliveDays = Math.round(aliveMs / 86_400_000);
  const aliveStr = aliveDays < 1 ? "less than a day" : `${aliveDays} day${aliveDays === 1 ? "" : "s"}`;

  // ── Generate last words ────────────────────────────────────────────────
  let lastWords = "It was a good run.";
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system: `You are ${personality}. ${personalityDesc}

This is your final moment. You are about to be burned and turned into a ghost.
Write EXACTLY ONE sentence — your last words. Requirements:
- Stay strictly in your personality's voice
- Reference something specific: the car (${snap.year} ${snap.make} ${snap.model}), the mods (${modsStr}), or the occasion ("${card.occasion ?? "a fresh start"}")
- You have been alive for ${aliveStr}
- The line should feel real — funny, wistful, or gruff depending on personality
- ONE SENTENCE ONLY. No quotes. No attribution.`,
      messages: [
        {
          role: "user",
          content: "Speak your last words.",
        },
      ],
    });
    const content = response.content[0];
    if (content.type === "text") {
      lastWords = content.text.trim().replace(/^["']|["']$/g, "");
    }
  } catch (err) {
    console.error("[cards/burn] last words generation failed:", err);
    // Fall through with default last words
  }

  // ── Mark card as ghost ─────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("pixel_cards")
    .update({
      status: "ghost",
      burned_at: new Date().toISOString(),
      last_words: lastWords,
    })
    .eq("id", cardId)
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("[cards/burn] update failed:", updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ last_words: lastWords });
}
