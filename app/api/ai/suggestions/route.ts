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
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`suggestions:${user.id}`, AI_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  // Validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = bodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid car_id" }, { status: 400 });
  }

  const { car_id } = result.data;

  // Verify car ownership
  const { data: carRaw } = await supabase
    .from("cars")
    .select("make, model, year, trim")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const car = carRaw as { make: string; model: string; year: number; trim: string | null } | null;

  if (!car) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  // Get installed mods for context
  const { data: modsRaw } = await supabase
    .from("mods")
    .select("name, category, cost")
    .eq("car_id", car_id)
    .eq("status", "installed")
    .limit(30);
  const mods = (modsRaw ?? []) as { name: string; category: string; cost: number | null }[];

  const modSummary = mods
    .map((m) => `${m.name} (${m.category})`)
    .join(", ") || "none yet";

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are an expert car tuning advisor.

Vehicle: ${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}
Current mods: ${modSummary}

Suggest exactly 5 next modifications that would complement this build. For each suggestion return valid JSON with these fields:
- name: mod name (string)
- category: one of: engine, suspension, aero, interior, wheels, exhaust, electronics, other
- reason: why this mod fits this specific car and build (1-2 sentences)
- estimatedCost: cost range as string (e.g. "$500–$1,200")
- searchQuery: a specific Amazon/retailer search query for this part

Return ONLY a JSON array of 5 objects. No markdown, no explanation.`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

    let suggestions: unknown[];
    try {
      // Strip potential markdown code fences
      const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      suggestions = JSON.parse(cleaned);
    } catch {
      suggestions = [];
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Suggestions error:", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions. Please try again." },
      { status: 500 }
    );
  }
}
