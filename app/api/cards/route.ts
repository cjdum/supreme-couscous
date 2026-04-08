import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { PixelCardSnapshot } from "@/lib/supabase/types";
import { randomEra } from "@/lib/pixel-card";

/**
 * POST /api/cards
 * body: { carId: string; occasion: string }
 *
 * Mints a new pixel card snapshot for a car.
 * Requirements:
 *   - At least 1 real photo (not a render or pixel-card)
 *   - occasion note required (max 100 chars) — frozen on the card forever
 *
 * No cooldown. Cards are independent rows. A car can have many cards.
 * Cards persist even if the car is deleted (car_id is set to null on delete).
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

function isRealPhoto(url: string): boolean {
  return !url.includes("render") && !url.includes("pixel-card") && !url.includes("generate");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`pixel-card:${user.id}`, { ...AI_RATE_LIMIT, limit: 6 });
  if (!rl.success) {
    return NextResponse.json({ error: "Slow down — try again in a minute." }, { status: 429 });
  }

  let body: { carId?: string; occasion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const carId = body.carId;
  if (!carId || typeof carId !== "string") {
    return NextResponse.json({ error: "carId required" }, { status: 400 });
  }

  const occasion = (body.occasion ?? "").trim().slice(0, 100);
  if (!occasion) {
    return NextResponse.json({ error: "Occasion note is required" }, { status: 400 });
  }

  // ── 1. Load car ─────────────────────────────────────────────────────────
  const { data: carRaw } = await supabase
    .from("cars")
    .select("id, user_id, make, model, year, color, trim, description, horsepower, vin_verified")
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
    trim: string | null;
    description: string | null;
    horsepower: number | null;
    vin_verified: boolean;
  } | null;

  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  // ── 1b. Require trim and color before minting ───────────────────────────
  if (!car.trim?.trim() || !car.color?.trim()) {
    return NextResponse.json(
      { error: "Fill in your car's trim and color before minting a card." },
      { status: 400 }
    );
  }

  // ── 2. Photo check ──────────────────────────────────────────────────────
  const { data: photosRaw } = await supabase
    .from("car_photos")
    .select("url")
    .eq("car_id", carId)
    .order("position", { ascending: true });

  const photos = (photosRaw ?? []) as { url: string }[];
  const realPhotos = photos.filter((p) => isRealPhoto(p.url));

  if (realPhotos.length < 1) {
    return NextResponse.json(
      { error: "Upload at least 1 real photo before minting." },
      { status: 400 }
    );
  }

  // ── 3. Mod list ─────────────────────────────────────────────────────────
  const { data: modsRaw } = await supabase
    .from("mods")
    .select("name, status")
    .eq("car_id", carId)
    .eq("status", "installed");

  const mods = ((modsRaw ?? []) as { name: string; status: string }[]).map((m) => m.name);

  // ── 4. Build snapshot ───────────────────────────────────────────────────
  const colorLabel = car.color?.trim() || "white";
  const trimLabel  = car.trim?.trim() || null;
  const description = (car.description ?? "").trim() || null;

  const snapshot: PixelCardSnapshot = {
    make:         car.make,
    model:        car.model,
    year:         car.year,
    color:        colorLabel,
    trim:         trimLabel,
    description,
    mods,
    mod_count:    mods.length,
    hp:           car.horsepower,
    build_score:  null,
    vin_verified: car.vin_verified,
  };

  // ── 5. Assign era (random, permanent) ──────────────────────────────────
  const era = randomEra();

  // ── 6. Run nickname + flavor text + DALL-E in parallel ──────────────────
  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json({ error: "Image generation isn't configured." }, { status: 503 });
  }

  const modList = mods.join(", ") || "stock";

  // Flavor text: 2-sentence poetic description of the car's spirit + occasion
  const flavorPromise = (async (): Promise<string | null> => {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 120,
        messages: [
          {
            role: "user",
            content: `Write flavor text for a collector's trading card for this car.

${car.year} ${car.make} ${car.model}${trimLabel ? " " + trimLabel : ""}, ${colorLabel}
Mods: ${modList}
Occasion: ${occasion}

Rules:
- Exactly 2 sentences.
- Poetic, cinematic, automotive. Racing legend meets heist movie.
- First sentence: the car's spirit or identity.
- Second sentence: its destiny or what it commands.
- Weave in the occasion subtly.
- No clichés: no "beast", "monster", "powerhouse", "legend", "unleash".
- Total max 180 characters.

Return only the 2-sentence text. No quotes, no labels.`,
          },
        ],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
      return text.slice(0, 280) || null;
    } catch {
      return null; // flavor text is optional — never block a mint
    }
  })();

  const nicknamePromise = (async () => {
    const nameMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 40,
      messages: [
        {
          role: "user",
          content: `Name this car for a collector's trading card.

${car.year} ${car.make} ${car.model}, color: ${colorLabel}
Mods: ${modList}
Occasion: ${occasion}
Description: ${description || "none provided"}

Rules:
- Exactly 3 words
- Dark, automotive, poetic tone. Heist movie or racing legend energy.
- Reference the color, mods, or occasion subtly
- Banned: Speed, Thunder, Beast, Turbo, Standard, Classic, Fast, Sport, Race, Power, any color as first word
- Good: "The Asphalt Ghost", "Carbon Low Season", "Midnight Tax Evasion", "The Quiet Predator"
- Bad: "Red Standard", "Blue Beast", "Turbo Sport Car"

Return only the 3-word name. Nothing else.`,
        },
      ],
    });

    const raw = nameMsg.content[0]?.type === "text" ? nameMsg.content[0].text : "";
    const words = raw
      .trim()
      .replace(/^["'`]|["'`]$/g, "")
      .replace(/[\n\r]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const finalWords = words.slice(0, 3);
    if (finalWords.length < 2) throw new Error("Nickname too short");
    const name = finalWords.join(" ");
    if (name.length < 2 || name.length > 60) throw new Error("Nickname length out of range");
    return name;
  })();

  const imagePromise = (async () => {
    // Prompt built exclusively from DB fields — make/model/year/color/trim
    const pixelPrompt = `A ${car.year} ${car.make} ${car.model}${trimLabel ? " " + trimLabel : ""}, year ${car.year}, exterior color ${colorLabel}.

View: 3/4 front driver side angle. The car fills 85% of the frame. Silhouette is accurate to the actual ${car.year} ${car.make} ${car.model}.

Style: True retro SNES-era pixel art. Hard chunky pixels. No anti-aliasing. No blur. No smooth gradients. Max 32 colors. Every pixel must be clearly blocky and visible. NOT photorealistic, NOT smooth, NOT rendered.

Color: The exterior paint color is ${colorLabel}. Use exactly "${colorLabel}" — do not substitute with poetic names, do not use crimson, scarlet, burgundy, or any synonym. If the color is "${colorLabel}", paint it "${colorLabel}".

Background: Solid flat dark color #0a0a18. No ground shadows. No gradient sky.

STRICT: No text of any kind. No letters. No numbers. No labels. No watermarks. No logos. No license plates. No badges. No card borders. No UI. No HUD. Only the car sprite.`;

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: pixelPrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid",
      response_format: "b64_json",
    });

    const first = imageResponse.data?.[0];
    if (!first?.b64_json && !first?.url) throw new Error("DALL-E returned no image");

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

    const ext  = contentType.includes("jpeg") ? "jpg" : "png";
    const path = `${user.id}/pixel-cards/${carId}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("car-covers")
      .upload(path, buffer, { contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: { publicUrl } } = supabase.storage.from("car-covers").getPublicUrl(path);
    return publicUrl;
  })();

  let nickname: string;
  let pixelCardUrl: string;
  let flavorText: string | null;
  try {
    [nickname, pixelCardUrl, flavorText] = await Promise.all([
      nicknamePromise,
      imagePromise,
      flavorPromise,
    ]);
  } catch (err) {
    console.error("[cards] generation failed:", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: `Couldn't mint your card. ${message}` }, { status: 500 });
  }

  // ── 7. Insert into pixel_cards ──────────────────────────────────────────
  const mintedAt = new Date().toISOString();

  const { data: cardRaw, error: insErr } = await supabase
    .from("pixel_cards")
    .insert({
      user_id:        user.id,
      car_id:         carId,
      car_snapshot:   snapshot,
      pixel_card_url: pixelCardUrl,
      nickname,
      hp:             car.horsepower,
      mod_count:      mods.length,
      minted_at:      mintedAt,
      flavor_text:    flavorText ?? null,
      era,
      occasion,
      // card_number is auto-assigned by the sequence
    })
    .select("id, user_id, car_id, car_snapshot, pixel_card_url, nickname, hp, mod_count, minted_at, card_number, flavor_text, era, occasion")
    .single();

  if (insErr || !cardRaw) {
    console.error("[cards] insert failed:", insErr?.message);
    return NextResponse.json({ error: insErr?.message ?? "Failed to save card" }, { status: 500 });
  }

  console.log(`[cards] minted card=${cardRaw.id} car=${carId} nickname="${nickname}" occasion="${occasion}"`);

  return NextResponse.json({ card: cardRaw });
}
