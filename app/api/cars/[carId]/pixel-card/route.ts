import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { calculateRarity } from "@/lib/pixel-card";

/**
 * POST /api/cars/[carId]/pixel-card
 *
 * One-shot, irreversible pixel-art trading card generator:
 *   1. Server-side eligibility check via check-eligibility logic
 *   2. Claude → exactly-3-word heist/legend nickname
 *   3. DALL-E 3 (HD) → true 8-bit SNES-era sprite, 3/4 front-left angle
 *   4. Snapshot: hp, mod_count, build_score, rarity frozen at mint time
 *
 * 409 on double-generation attempt. No admin override. Ever.
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
    return NextResponse.json({ error: "Slow down — try again in a minute." }, { status: 429 });
  }

  // ── 1. Load car ─────────────────────────────────────────────────────────
  const { data: carRaw } = await supabase
    .from("cars")
    .select(
      "id, user_id, make, model, year, color, trim, cover_image_url, horsepower, engine_size, specs_ai_guessed, description, pixel_card_url, pixel_card_nickname, vin_verified"
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
    trim: string | null;
    cover_image_url: string | null;
    horsepower: number | null;
    engine_size: string | null;
    specs_ai_guessed: boolean;
    description: string | null;
    pixel_card_url: string | null;
    pixel_card_nickname: string | null;
    vin_verified: boolean;
  } | null;

  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  // ── 2. One-shot guard ────────────────────────────────────────────────────
  if (car.pixel_card_url || car.pixel_card_nickname) {
    return NextResponse.json(
      { error: "This car already has a pixel card. Pixel cards are permanent." },
      { status: 409 }
    );
  }

  // ── 3. Fetch photos + mods in parallel ────────────────────────────────────
  const [{ data: allPhotosRaw }, { data: modsRaw }] = await Promise.all([
    supabase
      .from("car_photos")
      .select("url, image_descriptor")
      .eq("car_id", carId)
      .order("position", { ascending: true })
      .limit(8),
    supabase
      .from("mods")
      .select("name, category, status, cost, install_date, notes, shop_name, is_diy")
      .eq("car_id", carId),
  ]);

  const allPhotos = ((allPhotosRaw ?? []) as { url: string; image_descriptor: string | null }[]);
  const realPhotos = allPhotos.filter(
    (p) => !p.url.includes("/renders/") && !p.url.includes("/pixel-cards/")
  );

  const mods = (modsRaw ?? []) as {
    name: string;
    category: string;
    status: string;
    cost: number | null;
    install_date: string | null;
    notes: string | null;
    shop_name: string | null;
    is_diy: boolean;
  }[];

  // ── 4. Server-side eligibility ───────────────────────────────────────────
  const photoCount = realPhotos.length;
  if (photoCount < 2) {
    return NextResponse.json(
      { error: "Not eligible yet", unmet: ["Upload 2 real photos"] },
      { status: 400 }
    );
  }

  const description = (car.description ?? "").trim();
  if (description.length < 40) {
    return NextResponse.json(
      { error: "Not eligible yet", unmet: ["Write a real build story (40+ chars)"] },
      { status: 400 }
    );
  }

  const installed = mods.filter((m) => m.status === "installed");
  const qualifiedMod = installed.find(
    (m) => m.cost != null && m.cost > 0 && (m.shop_name != null || m.is_diy)
  );
  if (!qualifiedMod) {
    return NextResponse.json(
      { error: "Not eligible yet", unmet: ["Log 1 mod with cost & source"] },
      { status: 400 }
    );
  }

  // ── 5. Compute rarity from data richness ─────────────────────────────────
  const modCount = installed.length;
  const modsWithCost = installed.filter((m) => m.cost != null && m.cost > 0).length;
  const rarity = calculateRarity({
    vinVerified:        car.vin_verified,
    modsWithCostCount:  modsWithCost,
    totalModCount:      modCount,
    descriptionLength:  description.length,
  });

  const colorLabel = car.color?.trim() || "unknown color";
  const trimLabel  = car.trim?.trim() || "";
  const carLabel   = `${car.year} ${car.make} ${car.model}${trimLabel ? " " + trimLabel : ""}`;

  // Top mods by cost for prompt context
  const topMods = [...installed]
    .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
    .slice(0, 10)
    .map((m) => {
      const source = m.is_diy ? "DIY" : m.shop_name ? m.shop_name : "unknown source";
      const cost   = m.cost ? `$${m.cost.toLocaleString()}` : "unknown cost";
      return `${m.name} (${m.category}, ${cost}, ${source})`;
    });

  const modList = topMods.length > 0 ? topMods.join("; ") : "no modifications";
  const photoDesc = realPhotos[0]?.image_descriptor
    ? `First photo: ${realPhotos[0].image_descriptor}`
    : "";
  const vinLine = car.vin_verified
    ? "VIN verified (NHTSA confirmed)"
    : "VIN not verified";

  // ── 6. Claude → 3-word nickname ─────────────────────────────────────────
  let nickname: string;
  try {
    const nameMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 40,
      messages: [
        {
          role: "user",
          content: `You are naming a car for a permanent collector trading card. The name becomes its identity forever.

Car: ${carLabel}
Color: ${colorLabel}
Mods: ${modList}
Description: ${description.slice(0, 600)}
${photoDesc}
Rarity: ${rarity}
${vinLine}

Rules:
- EXACTLY 3 words. Always 3. Not 1, not 2, not 4. THREE.
- Tone: dark, cinematic, poetic — a heist movie car, a racing legend, a ghost on the highway
- Draw from the COLOR, the MODS, and the MOOD of the description
- Higher rarity = more legendary, mythic feel
- Banned words: Speed Thunder Beast Turbo Standard Classic Fast Sport Race Power Chrome
- Don't start with a color name (Red, Blue, Black, White, Silver, Gray, Green, Yellow)
- Good examples: "The Asphalt Ghost", "Carbon Low Season", "Midnight Tax Evasion", "The Quiet Predator", "Stolen Sunday Morning", "Iron Curtain Pardon"
- Bad examples: "Red Fast Car", "Speedy Thunder Beast", "Blue Sport Racer"

Return ONLY the 3-word name. No punctuation, no quotes, no explanation.`,
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
    nickname = finalWords.join(" ");
    if (nickname.length < 2 || nickname.length > 60) throw new Error("Nickname length out of range");
  } catch (err) {
    console.error("[pixel-card] nickname generation failed:", err);
    return NextResponse.json({ error: "Couldn't generate a nickname. Try again." }, { status: 500 });
  }

  // ── 7. DALL-E 3 (HD) → true 8-bit SNES sprite ───────────────────────────
  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json({ error: "Image generation isn't configured." }, { status: 503 });
  }

  let pixelCardUrl: string;
  try {
    const pixelPrompt =
      `Create a true 8-bit SNES-era pixel art sprite of a ${carLabel} in ${colorLabel}. ` +
      `This must look exactly like a real Super Nintendo video game car sprite — chunky, blocky pixels, ` +
      `strictly limited color palette (16–32 colors max), clearly visible square pixel grid, ` +
      `intentionally low resolution. NOT smooth, NOT HD, NOT photorealistic, NOT vector art. ` +
      `3/4 front-left view angle, car fills 80% of the frame. ` +
      `The car silhouette must match the actual body style of a ${car.year} ${car.make} ${car.model} — ` +
      `preserve its distinctive roofline, proportions, and front-end design. ` +
      `Primary body color: ${colorLabel} — reproduce this faithfully. ` +
      `${car.vin_verified ? "This car's identity is NHTSA-verified — accuracy matters." : ""} ` +
      `Solid near-black background (#0d0d1a). Bold black pixel outlines. High contrast. ` +
      `No text, no UI, no card frame, no borders, no logos — just the car sprite on a dark background.`;

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
    pixelCardUrl = publicUrl;
  } catch (err) {
    console.error("[pixel-card] image generation failed:", err);
    return NextResponse.json({ error: "Couldn't render the pixel card. Try again." }, { status: 500 });
  }

  // ── 8. Atomic save with concurrency guard ────────────────────────────────
  const generatedAt = new Date().toISOString();
  const { data: updatedRaw, error: updErr } = await supabase
    .from("cars")
    .update({
      pixel_card_url:          pixelCardUrl,
      pixel_card_nickname:     nickname,
      pixel_card_generated_at: generatedAt,
      pixel_card_hp:           car.horsepower,
      pixel_card_mod_count:    modCount,
      pixel_card_build_score:  null, // deprecated in favor of data-richness rarity
      pixel_card_rarity:       rarity,
      updated_at:              generatedAt,
    })
    .eq("id", carId)
    .eq("user_id", user.id)
    .is("pixel_card_url", null)
    .select("id, pixel_card_url, pixel_card_nickname, pixel_card_generated_at, pixel_card_hp, pixel_card_mod_count, pixel_card_rarity")
    .maybeSingle();

  if (updErr) {
    console.error("[pixel-card] db update failed:", updErr.message);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  if (!updatedRaw) {
    return NextResponse.json({ error: "This car already has a pixel card." }, { status: 409 });
  }

  console.log(`[pixel-card] minted car=${carId} nickname="${nickname}" rarity=${rarity} vinVerified=${car.vin_verified}`);

  return NextResponse.json({
    pixel_card_url:          pixelCardUrl,
    pixel_card_nickname:     nickname,
    pixel_card_generated_at: generatedAt,
    pixel_card_hp:           car.horsepower,
    pixel_card_mod_count:    modCount,
    pixel_card_build_score:  null,
    pixel_card_rarity:       rarity,
    vin_verified:            car.vin_verified,
  });
}
