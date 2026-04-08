import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
  car_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tighter limit — this is just for fun
  const rl = rateLimit(`roast:${user.id}`, { limit: 5, windowSec: 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many roasts. Give it a minute." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid car_id" }, { status: 400 });
  }

  const { data: car } = await supabase
    .from("cars")
    .select("make, model, year, trim, color, horsepower, torque, zero_to_sixty, drivetrain")
    .eq("id", parsed.data.car_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!car) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  const { data: modsRaw } = await supabase
    .from("mods")
    .select("name, category, cost, is_diy")
    .eq("car_id", parsed.data.car_id)
    .eq("status", "installed")
    .order("created_at", { ascending: true });
  const mods = modsRaw ?? [];

  const totalSpent = mods.reduce((s, m) => s + (m.cost ?? 0), 0);
  const categoryCount = new Set(mods.map((m) => m.category)).size;
  const diyCount = mods.filter((m) => m.is_diy).length;

  const modList =
    mods.length === 0
      ? "(no mods yet)"
      : mods.map((m) => `- ${m.name} (${m.category}${m.cost ? `, $${m.cost}` : ""}${m.is_diy ? ", DIY" : ""})`).join("\n");

  const carLine = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}${car.color ? ` in ${car.color}` : ""}`;

  const prompt = `You're a savage but affectionate car enthusiast who roasts people's builds on the internet. Your goal is to make the owner laugh, not cry. Punch UP at common mistakes, clichés, and questionable decisions — never punch down at budget, age, or experience level.

Here's the build to roast:

CAR: ${carLine}
STOCK POWER: ${car.horsepower ? `${car.horsepower} hp` : "unknown"}${car.torque ? `, ${car.torque} lb-ft` : ""}${car.zero_to_sixty ? `, ${car.zero_to_sixty}s 0-60` : ""}
DRIVETRAIN: ${car.drivetrain ?? "unknown"}

MODS (${mods.length} total, ${categoryCount} categories, ${diyCount} DIY, $${totalSpent.toLocaleString()} spent):
${modList}

RULES:
1. Exactly 2 paragraphs, 3-5 sentences each. No preamble, no "here's my roast". Start with the burn.
2. Reference specific mods or stats from the list above. Be precise, not generic.
3. Be funny, sharp, slightly mean but ultimately warm — end on something genuinely nice.
4. NO corny dad jokes. NO "this car walked into a bar". NO emoji.
5. Plain text only. No markdown, no bullets, no headers.
6. If the build is mostly empty, roast the potential, not the lack.

Go.`;

  try {
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "Empty roast from model" }, { status: 502 });
    }

    return NextResponse.json({ roast: text });
  } catch (err) {
    console.error("[roast] error", err);
    return NextResponse.json({ error: "Failed to generate roast" }, { status: 500 });
  }
}
