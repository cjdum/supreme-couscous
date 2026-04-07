import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * POST /api/ai/plan-wishlist
 *
 * Feature 17 — AI-assisted future-mod planning. Takes a car_id, reads the
 * existing wishlist + installed mods, and asks Claude to lay out a *build
 * path*: priority order, dependencies, install groupings, and a rough monthly
 * savings target. Streams the response so it feels alive.
 */

const bodySchema = z.object({
  car_id: z.string().uuid(),
  // Optional monthly budget the user can save toward parts.
  monthly_budget: z.number().int().min(0).max(100000).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const rl = rateLimit(`plan-wishlist:${user.id}`, { ...AI_RATE_LIMIT, limit: 12 });
  if (!rl.success) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const result = bodySchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
  }
  const { car_id, monthly_budget } = result.data;

  // Verify ownership + grab the car details
  const { data: carRaw } = await supabase
    .from("cars")
    .select("id, make, model, year, trim, color, horsepower, drivetrain")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!carRaw) {
    return new Response(JSON.stringify({ error: "Car not found" }), { status: 404 });
  }
  const car = carRaw as {
    id: string;
    make: string;
    model: string;
    year: number;
    trim: string | null;
    color: string | null;
    horsepower: number | null;
    drivetrain: string | null;
  };

  // Fetch the full mod catalog for this car so the AI knows installed AND wishlist
  const { data: modsRaw } = await supabase
    .from("mods")
    .select("name, category, cost, status, notes")
    .eq("car_id", car_id);
  const mods = (modsRaw ?? []) as {
    name: string;
    category: string;
    cost: number | null;
    status: string;
    notes: string | null;
  }[];

  const installed = mods.filter((m) => m.status === "installed");
  const wishlist = mods.filter((m) => m.status === "wishlist");

  if (wishlist.length === 0) {
    return new Response(
      JSON.stringify({
        error: "Wishlist is empty — add a few parts you're eyeing first, then I'll plan the build.",
      }),
      { status: 400 }
    );
  }

  const installedBlock = installed.length
    ? installed
        .map((m) => `• ${m.name} (${m.category})${m.cost ? ` — $${m.cost}` : ""}`)
        .join("\n")
    : "• Stock / nothing installed yet";

  const wishlistBlock = wishlist
    .map(
      (m) =>
        `• ${m.name} (${m.category})${m.cost ? ` — ~$${m.cost}` : ""}${m.notes ? ` — ${m.notes.slice(0, 100)}` : ""}`
    )
    .join("\n");

  const totalWishlistCost = wishlist.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  const carLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;

  const systemPrompt = `You are VAULT — a build planner who knows cars cold. You're laying out the smartest order to install this user's wishlist parts.

VOICE:
- Punchy enthusiast. No corporate hedging.
- Real numbers, real brands, real specifics.
- 2-4 sentences per phase. Bullet lists where it helps.
- Lead with the recommendation, back it up with the reason in one sentence.

OUTPUT FORMAT (use markdown headings exactly as shown):
## The Path
Brief 2-sentence overview of the strategy you're recommending and WHY (e.g., "supporting mods first, then power", "stance + handling before HP", etc.).

## Phase 1 — Foundation
The 1-3 mods to do FIRST. Each as a bullet with name → why-now → rough cost.

## Phase 2 — Build It Out
Next 2-4 mods. Same format.

## Phase 3 — The Big Hits
The remaining bigger-ticket items. Same format.

## Heads-Up
Any dependencies, gotchas, or "you'll need to also budget for X" items the user should know. 2-4 bullets max.

${monthly_budget ? `## Timeline\nWith a $${monthly_budget}/mo savings rate, when each phase becomes affordable. Be specific.\n` : ""}
RULES:
- Group mods that should be installed together (e.g., coilovers + alignment, intake + tune).
- Call out safety-critical pairings ("don't go bigger turbo without fuel system upgrade").
- Don't invent mods that aren't on the wishlist. You can mention supporting parts as "heads-up" items.
- Don't preach about budget — just plan.`;

  const userMessage = `═══ THE CAR ═══
${carLabel}
${car.color ? `Color: ${car.color}\n` : ""}${car.horsepower ? `Power: ${car.horsepower}hp\n` : ""}${car.drivetrain ? `Drivetrain: ${car.drivetrain}\n` : ""}
═══ ALREADY INSTALLED ═══
${installedBlock}

═══ WISHLIST (${wishlist.length} items, ~$${totalWishlistCost}) ═══
${wishlistBlock}
${monthly_budget ? `\n═══ SAVINGS RATE ═══\n$${monthly_budget}/month` : ""}

Plan the smartest install path for this build. Use the format above.`;

  console.log(
    `[plan-wishlist] user=${user.id} car=${car_id} wishlist=${wishlist.length} installed=${installed.length} budget=${monthly_budget ?? "none"}`
  );

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } catch (err) {
          console.error("[plan-wishlist] stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("[plan-wishlist] anthropic error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Failed to plan: ${msg}` }),
      { status: 500 }
    );
  }
}
