import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { checkPixelCardEligibility } from "@/lib/pixel-card";
import { calculateBuildScore } from "@/lib/build-score";

/**
 * POST /api/cars/[carId]/pixel-card
 *
 * One-shot, irreversible pixel-art trading card generator. Combines:
 *   1. Claude → restrained car-culture nickname (1-3 words)
 *   2. DALL-E 3 → 16-bit pixel sprite of the car
 *
 * Both are persisted atomically. If a card already exists for this car, the
 * route returns 409 — no regeneration, ever.
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

interface Params {
  params: Promise<{ carId: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`pixel-card:${user.id}`, { ...AI_RATE_LIMIT, limit: 6 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Slow down — try again in a minute." },
      { status: 429 }
    );
  }

  // ── 1. Verify ownership + load everything we need in one shot ──
  const { data: carRaw } = await supabase
    .from("cars")
    .select(
      "id, user_id, make, model, year, color, cover_image_url, horsepower, engine_size, specs_ai_guessed, description, pixel_card_url, pixel_card_nickname"
    )
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();

  const car = carRaw as {
    id: string;
    user_id: string;
    make: string;
    model: string;
    year: number;
    color: string | null;
    cover_image_url: string | null;
    horsepower: number | null;
    engine_size: string | null;
    specs_ai_guessed: boolean;
    description: string | null;
    pixel_card_url: string | null;
    pixel_card_nickname: string | null;
  } | null;

  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  // ── 2. Already generated? Return 409. NEVER regenerate. ──
  if (car.pixel_card_url || car.pixel_card_nickname) {
    return NextResponse.json(
      { error: "This car already has a pixel card. Pixel cards are permanent." },
      { status: 409 }
    );
  }

  // ── 3. Server-side eligibility ──
  const [{ count: photoCount }, { data: modsRaw }] = await Promise.all([
    supabase
      .from("car_photos")
      .select("id", { count: "exact", head: true })
      .eq("car_id", carId),
    supabase
      .from("mods")
      .select("name, category, status, cost, install_date, notes")
      .eq("car_id", carId),
  ]);

  const mods = (modsRaw ?? []) as {
    name: string;
    category: string;
    status: string;
    cost: number | null;
    install_date: string | null;
    notes: string | null;
  }[];

  const buildScoreResult = calculateBuildScore({
    cars: [
      {
        cover_image_url: car.cover_image_url,
        horsepower: car.horsepower,
        engine_size: car.engine_size,
        specs_ai_guessed: car.specs_ai_guessed,
        is_primary: true,
      },
    ],
    mods,
  });

  const eligibility = checkPixelCardEligibility({
    photoCount: photoCount ?? 0,
    description: car.description,
    make: car.make,
    model: car.model,
    year: car.year,
    buildScore: buildScoreResult.buildScore.score,
  });

  if (!eligibility.eligible) {
    const unmet = eligibility.requirements.filter((r) => !r.met).map((r) => r.label);
    return NextResponse.json(
      { error: "Not eligible yet", unmet },
      { status: 400 }
    );
  }

  // ── 4. Need a real photo to feed DALL-E. Pull the cover ──
  if (!car.cover_image_url) {
    return NextResponse.json(
      { error: "Set a cover photo first." },
      { status: 400 }
    );
  }

  const installed = mods.filter((m) => m.status === "installed");
  const modList = installed.length
    ? installed.slice(0, 12).map((m) => m.name).join(", ")
    : "no mods listed";
  const carLabel = `${car.year} ${car.make} ${car.model}`;
  const colorLabel = car.color ?? "factory color";

  // ── 5. Claude → nickname ──
  let nickname: string;
  try {
    const nameMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 60,
      messages: [
        {
          role: "user",
          content: `You are naming a car for a collector's card. Given this car: ${carLabel}, color: ${colorLabel}, mods: ${modList}, owner description: ${(car.description ?? "").slice(0, 600)}.

Generate a single nickname.

Rules:
- 1-3 words MAX
- Tone: restrained, automotive, slightly moody — think car culture not video games
- No generic words like "speed", "thunder", "beast", "turbo", "fast", "monster", "fury", "rage"
- No emojis, no quotation marks, no punctuation
- Must feel like a name a real collector would pick

Examples of good names: "The Widow", "Carbon Ghost", "Midnight Tax", "Low Season", "Hush", "Quiet Riot", "Threadbare", "Black Sunday".

Return ONLY the nickname, nothing else. No preamble, no explanation.`,
        },
      ],
    });

    const raw = nameMsg.content[0]?.type === "text" ? nameMsg.content[0].text : "";
    nickname = raw
      .trim()
      .replace(/^["'`]|["'`]$/g, "")
      .replace(/[\n\r]/g, " ")
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
    if (!nickname || nickname.length < 2 || nickname.length > 40) {
      throw new Error("Nickname generation produced an unusable result");
    }
  } catch (err) {
    console.error("[pixel-card] nickname generation failed:", err);
    return NextResponse.json(
      { error: "Couldn't generate a nickname. Try again." },
      { status: 500 }
    );
  }

  // ── 6. DALL-E → pixel sprite (uses real photo via descriptor in prompt) ──
  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json(
      { error: "Image generation isn't configured." },
      { status: 503 }
    );
  }

  let pixelCardUrl: string;
  try {
    const pixelPrompt = `Pixel art trading card illustration of a ${carLabel}, ${colorLabel}. Style: 16-bit pixel art, clean sprite, side profile view, slightly angled. Color palette faithful to the real car. Bold black outline. Solid dark background (#0a0c10). No text, no UI elements, no card frame, no borders, no logos — just the car sprite, centered. High contrast, collector card quality. Crisp pixels, no anti-aliasing artifacts.`;

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: pixelPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
      response_format: "b64_json",
    });

    const first = imageResponse.data?.[0];
    if (!first?.b64_json && !first?.url) {
      throw new Error("DALL-E returned no image");
    }

    // Persist the bytes to storage
    let buffer: Buffer;
    let contentType = "image/png";
    if (first.b64_json) {
      buffer = Buffer.from(first.b64_json, "base64");
    } else if (first.url) {
      const res = await fetch(first.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      contentType = res.headers.get("content-type") ?? "image/png";
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      throw new Error("No image data");
    }

    const ext = contentType.includes("jpeg") ? "jpg" : "png";
    const path = `${user.id}/pixel-cards/${carId}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("car-covers")
      .upload(path, buffer, { contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from("car-covers").getPublicUrl(path);
    pixelCardUrl = publicUrl;
  } catch (err) {
    console.error("[pixel-card] image generation failed:", err);
    return NextResponse.json(
      { error: "Couldn't render the pixel card. Try again." },
      { status: 500 }
    );
  }

  // ── 7. Atomic save (with concurrency guard: only update if still null) ──
  const generatedAt = new Date().toISOString();
  const { data: updatedRaw, error: updErr } = await supabase
    .from("cars")
    .update({
      pixel_card_url: pixelCardUrl,
      pixel_card_nickname: nickname,
      pixel_card_generated_at: generatedAt,
      updated_at: generatedAt,
    })
    .eq("id", carId)
    .eq("user_id", user.id)
    .is("pixel_card_url", null)
    .select("id, pixel_card_url, pixel_card_nickname, pixel_card_generated_at")
    .maybeSingle();

  if (updErr) {
    console.error("[pixel-card] db update failed:", updErr.message);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  if (!updatedRaw) {
    // Lost the race — somebody else generated first.
    return NextResponse.json(
      { error: "This car already has a pixel card." },
      { status: 409 }
    );
  }

  console.log(`[pixel-card] generated for car=${carId} nickname="${nickname}"`);

  return NextResponse.json({
    pixel_card_url: pixelCardUrl,
    pixel_card_nickname: nickname,
    pixel_card_generated_at: generatedAt,
  });
}
