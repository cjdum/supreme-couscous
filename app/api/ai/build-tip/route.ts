import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * POST /api/ai/build-tip
 * body: { carLabel: string; mods: string }
 *
 * Returns a single-sentence build suggestion. Cache per session client-side.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`build-tip:${user.id}`, { windowSec: 60, limit: 10 });
  if (!rl.success) return NextResponse.json({ tip: null }, { status: 200 });

  let body: { carLabel?: string; mods?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const carLabel = (body.carLabel ?? "").trim();
  const mods = (body.mods ?? "").trim();

  if (!carLabel) return NextResponse.json({ tip: null });

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [
        {
          role: "user",
          content: `You are a car build advisor. Give one short, specific, actionable suggestion for this build.

Car: ${carLabel}
Installed mods: ${mods || "none yet"}

Rules:
- Exactly one sentence, max 120 characters.
- Specific and relevant to the mods list.
- Practical — a real next step.
- No filler words, no "I recommend", just the tip.

Return only the sentence.`,
        },
      ],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
    return NextResponse.json({ tip: text?.slice(0, 160) ?? null });
  } catch {
    return NextResponse.json({ tip: null });
  }
}
