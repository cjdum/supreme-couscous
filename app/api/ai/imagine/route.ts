import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { sanitize } from "@/lib/utils";

/**
 * POST /api/ai/imagine
 *
 * "Imagine" — feature 18. Takes a single car + a one-line direction and
 * fans out to N parallel DALL-E renders, each based on a *distinct creative
 * interpretation* of the user's idea. Returns all rendered URLs at once so the
 * UI can show a 4-up / 6-up grid the user picks from.
 *
 * Architecture:
 *   1. Claude generates N diverse one-line interpretations of the prompt
 *      (e.g. "track-day stance", "stanced street", "rally tribute"...).
 *   2. For each interpretation, Claude crafts a full DALL-E prompt seeded
 *      with the car details + the cached image_descriptor.
 *   3. All DALL-E calls run in parallel (Promise.allSettled — partial
 *      success is fine; we return what we got).
 *   4. Each successful render is persisted to storage and a renders row.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim().length === 0) return null;
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

const bodySchema = z.object({
  car_id: z.string().uuid(),
  prompt: z.string().min(5).max(500),
  count: z.number().int().min(2).max(6).default(4),
});

async function persistRender(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  source: { url?: string | null; b64?: string | null }
): Promise<string> {
  let buffer: Buffer;
  let contentType = "image/png";

  if (source.b64 && source.b64.length > 0) {
    buffer = Buffer.from(source.b64, "base64");
  } else if (source.url) {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    contentType = res.headers.get("content-type") ?? "image/png";
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    throw new Error("No image data");
  }

  const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const path = `${userId}/renders/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("car-covers")
    .upload(path, buffer, { contentType, upsert: false });
  if (upErr) throw new Error(upErr.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("car-covers").getPublicUrl(path);
  return publicUrl;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Imagine fans out N images at once, so it's heavier than visualize. Use a
  // tighter per-call budget by treating each invocation as N units.
  const rl = rateLimit(`imagine:${user.id}`, { ...AI_RATE_LIMIT, limit: 6 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "You're imagining a lot. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = bodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { car_id, prompt, count } = result.data;
  const cleanPrompt = sanitize(prompt);

  // Fetch the car (RLS will reject if not the user's)
  const { data: carRaw, error: carErr } = await supabase
    .from("cars")
    .select("id, make, model, year, trim, color, horsepower, drivetrain")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (carErr || !carRaw) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
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

  // Pull the cached image_descriptor for the cover photo (Perf 20).
  const { data: photoRaw } = await supabase
    .from("car_photos")
    .select("image_descriptor")
    .eq("car_id", car_id)
    .order("is_cover", { ascending: false })
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  const descriptor = (photoRaw as { image_descriptor: string | null } | null)?.image_descriptor ?? null;

  const carLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const colorLabel = car.color ?? "factory color";

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json(
      { error: "Image generation is not configured (OPENAI_API_KEY missing)." },
      { status: 503 }
    );
  }

  // ── Step 1: Ask Claude for N distinct creative interpretations ──
  console.log(`[imagine] user=${user.id} car=${car_id} count=${count} prompt="${cleanPrompt.slice(0, 80)}"`);

  type Variant = { label: string; dallePrompt: string };
  let variants: Variant[] = [];

  try {
    const planMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You're planning ${count} DIVERSE creative directions for an AI render of a real user's car.

═══ CAR ═══
${carLabel}
Color: ${colorLabel}
${car.horsepower ? `Power: ${car.horsepower}hp\n` : ""}${car.drivetrain ? `Drivetrain: ${car.drivetrain}\n` : ""}
${descriptor ? `\n═══ REFERENCE PHOTO TRAITS ═══\n${descriptor}\n` : ""}
═══ USER DIRECTION ═══
${cleanPrompt}

═══ TASK ═══
Generate exactly ${count} distinct creative interpretations of the user direction. Each should explore a *different aesthetic angle* — stance, scene, livery, era, mood — while still honoring what the user asked for. Variety is the goal: don't just shuffle adjectives.

For EACH variant, output:
LABEL: <2-4 word descriptor, e.g. "Track Day", "Stanced Street", "Rally Tribute">
PROMPT: <full DALL-E 3 prompt, 80-140 words. MUST lead with "A photorealistic photograph of a ${carLabel}". Explicitly state make/model/year/color. Preserve signature ${car.make} ${car.model} silhouette. Integrate the user's direction with this variant's twist. Professional automotive photography, natural lighting, 3/4 or side profile, sharp focus, no text, no people, no badging invention. ${descriptor ? "Match the reference photo's paint, wheels, and stance." : ""}>

Separate variants with "---". Output ONLY the labelled variants, no preamble.`,
        },
      ],
    });

    const planText = planMsg.content[0]?.type === "text" ? planMsg.content[0].text : "";
    variants = planText
      .split(/\n---+\n|\n---+|---+\n/)
      .map((block) => {
        const labelMatch = block.match(/LABEL:\s*(.+)/i);
        const promptMatch = block.match(/PROMPT:\s*([\s\S]+)/i);
        if (!labelMatch || !promptMatch) return null;
        return {
          label: labelMatch[1].trim().replace(/["\n]/g, "").slice(0, 40),
          dallePrompt: promptMatch[1].trim().replace(/^"|"$/g, ""),
        };
      })
      .filter((v): v is Variant => v !== null)
      .slice(0, count);

    if (variants.length === 0) {
      throw new Error("Claude did not produce any valid variants");
    }
    console.log(`[imagine] parsed ${variants.length} variants: ${variants.map((v) => v.label).join(", ")}`);
  } catch (err) {
    console.error("[imagine] variant planning failed:", err);
    return NextResponse.json(
      { error: "Couldn't plan render variants. Try a clearer direction." },
      { status: 500 }
    );
  }

  // ── Step 2: Fan out to DALL-E in parallel ──
  const dalleResults = await Promise.allSettled(
    variants.map(async (variant) => {
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: variant.dallePrompt,
        n: 1,
        size: "1792x1024",
        quality: "standard", // standard is ~3x faster than hd; the user picks one to "promote" later
        style: "natural",
        response_format: "b64_json",
      });
      const first = imageResponse.data?.[0];
      if (!first?.b64_json && !first?.url) {
        throw new Error("DALL-E returned no image");
      }
      const publicUrl = await persistRender(supabase, user.id, {
        b64: first.b64_json,
        url: first.url,
      });
      return { variant, publicUrl };
    })
  );

  // ── Step 3: Insert the successful renders ──
  const successful = dalleResults
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((r): r is { variant: Variant; publicUrl: string } => r !== null);

  if (successful.length === 0) {
    const firstErr = dalleResults.find((r) => r.status === "rejected");
    const reason = firstErr?.status === "rejected" ? String(firstErr.reason) : "All renders failed";
    console.error("[imagine] all variants failed:", reason);
    return NextResponse.json(
      { error: `All renders failed: ${reason}` },
      { status: 500 }
    );
  }

  const inserts = successful.map((s) => ({
    car_id,
    user_id: user.id,
    user_prompt: `${cleanPrompt} — ${s.variant.label}`,
    image_prompt: s.variant.dallePrompt,
    image_url: s.publicUrl,
  }));

  const { data: rendersRaw, error: insErr } = await supabase
    .from("renders")
    .insert(inserts)
    .select();

  if (insErr) {
    console.error("[imagine] db insert failed:", insErr.message);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  console.log(`[imagine] success: ${successful.length}/${variants.length} renders saved`);
  return NextResponse.json({
    renders: rendersRaw,
    requested: variants.length,
    delivered: successful.length,
  });
}
