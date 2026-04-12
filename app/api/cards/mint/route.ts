import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type {
  PixelCardSnapshot,
  EstimatedPerformance,
  CardTrait,
} from "@/lib/supabase/types";
import { randomEra, assignRarity } from "@/lib/pixel-card";
import { randomPersonality } from "@/lib/card-personality";

/**
 * POST /api/cards/mint
 *
 * Takes a user-reviewed payload from /api/cards/generate and actually mints
 * the card:
 *   - generates the pixel art via Pollinations (text-only — no reference photos)
 *   - persists the pixel_card row with ALL generated + user-edited fields
 *   - returns the new card row
 *
 * Requirements:
 *   - At least one real photo (not a render) on the car.
 *   - occasion note required (frozen on the card forever, max 100 chars).
 *   - All generation data from /generate must be present in the payload.
 */

// Allow up to 2 minutes — Pollinations image gen can take 30-90s
export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function isRealPhoto(url: string): boolean {
  return !url.includes("render") && !url.includes("pixel-card") && !url.includes("generate");
}

interface MintBody {
  carId: string;
  occasion: string;
  isPublic?: boolean;
  // Reviewed fields from /generate
  cardTitle: string;
  buildArchetype: string;
  estimatedPerformance: EstimatedPerformance;
  aiEstimatedPerformance: EstimatedPerformance;
  buildAggression: number;
  uniquenessScore: number;
  authenticityConfidence: number;
  traits: CardTrait[];
  flavourText: string;
  weaknesses: string[];
  rivalArchetypes: string[];
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`cards-mint:${user.id}`, { ...AI_RATE_LIMIT, limit: 6 });
  if (!rl.success) {
    return NextResponse.json({ error: "Slow down — try again in a minute." }, { status: 429 });
  }

  let body: MintBody;
  try {
    body = (await req.json()) as MintBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const carId = body.carId;
  const occasion = (body.occasion ?? "").trim().slice(0, 100);
  const isPublic = body.isPublic !== false;

  if (!carId) return NextResponse.json({ error: "carId required" }, { status: 400 });
  if (!occasion) return NextResponse.json({ error: "Occasion note is required" }, { status: 400 });
  if (!body.cardTitle?.trim()) {
    return NextResponse.json({ error: "cardTitle is required" }, { status: 400 });
  }
  if (!body.buildArchetype || !body.estimatedPerformance) {
    return NextResponse.json({ error: "Review payload incomplete" }, { status: 400 });
  }

  // ── Load car ───────────────────────────────────────────────────────────
  const { data: carRaw } = await supabase
    .from("cars")
    .select("id, user_id, make, model, year, color, trim, description, horsepower, torque, zero_to_sixty, top_speed, vin_verified")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();
  const car = carRaw as {
    id: string; user_id: string; make: string; model: string; year: number;
    color: string | null; trim: string | null; description: string | null;
    horsepower: number | null; torque: number | null; zero_to_sixty: number | null;
    top_speed: number | null; vin_verified: boolean;
  } | null;
  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  // ── Photo check ────────────────────────────────────────────────────────
  const { data: photosRaw } = await supabase
    .from("car_photos")
    .select("url")
    .eq("car_id", carId)
    .order("position", { ascending: true });
  const photos = (photosRaw ?? []) as { url: string }[];
  if (photos.filter((p) => isRealPhoto(p.url)).length < 1) {
    return NextResponse.json({ error: "Upload at least 1 real photo before minting." }, { status: 400 });
  }

  // ── Mod list ───────────────────────────────────────────────────────────
  const { data: modsRaw } = await supabase
    .from("mods")
    .select("name, status, cost, category")
    .eq("car_id", carId)
    .eq("status", "installed");
  type ModRow = { name: string; status: string; cost: number | null; category: string };
  const modRows = (modsRaw ?? []) as ModRow[];
  const mods = modRows.map((m) => m.name);
  const modsDetail = modRows.map((m) => ({ name: m.name, cost: m.cost, category: m.category }));
  const totalInvested = modRows.reduce((s, m) => s + (m.cost ?? 0), 0);

  // ── Build the frozen snapshot ───────────────────────────────────────────
  // trim and color are now optional — fall back gracefully for pixel art
  const colorLabel = car.color?.trim() || "custom color";
  const trimLabel  = car.trim?.trim()  || "";

  const snapshot: PixelCardSnapshot = {
    make: car.make,
    model: car.model,
    year: car.year,
    color: colorLabel,
    trim: trimLabel,
    description: (car.description ?? "").trim() || null,
    mods,
    mods_detail: modsDetail,
    mod_count: mods.length,
    hp: body.estimatedPerformance.hp,
    torque: body.estimatedPerformance.torque,
    zero_to_sixty: body.estimatedPerformance.zero_to_sixty,
    total_invested: totalInvested,
    build_score: null,
    vin_verified: car.vin_verified,
    stock_hp: car.horsepower,
    stock_torque: car.torque,
    stock_zero_to_sixty: car.zero_to_sixty,
    stock_top_speed: car.top_speed,
  };

  const era = randomEra();
  const rarity = assignRarity(mods.length, totalInvested, null, Math.random());
  const personality = randomPersonality();

  // Increment profile's card_level (total mints ever) and use it as this card's level
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("card_level")
    .eq("user_id", user.id)
    .maybeSingle();
  const currentLevel = (profileRaw as { card_level: number } | null)?.card_level ?? 0;
  const newCardLevel = currentLevel + 1;
  // Bump profile level (fire-and-forget)
  supabase.from("profiles").update({ card_level: newCardLevel }).eq("user_id", user.id).then(() => {}, () => {});

  // ── Generate pixel art via DALL-E 2 ────────────────────────────────────
  let pixelCardUrl: string;
  try {
    const pixelPrompt = `${car.year} ${car.make} ${car.model} (${car.year} generation body style), ${colorLabel}, pixel art, 16-bit retro sprite, 3/4 front angle, full car visible, dark background. No text, no letters, no numbers, no labels, no watermarks.`;

    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-2",
        prompt: pixelPrompt,
        n: 1,
        size: "512x512",
        response_format: "url",
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!dalleRes.ok) {
      const errText = await dalleRes.text();
      throw new Error(`DALL-E error ${dalleRes.status}: ${errText}`);
    }

    const dalleData = await dalleRes.json() as { data: { url: string }[] };
    const tempUrl = dalleData.data[0]?.url;
    if (!tempUrl) throw new Error("No image URL in DALL-E response");

    // Download generated image and upload to Supabase storage
    const imgResponse = await fetch(tempUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imgResponse.ok) throw new Error(`Image download failed: ${imgResponse.status}`);
    const imgBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(imgBuffer);
    const path = `${user.id}/pixel-cards/${carId}-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from("car-covers")
      .upload(path, buffer, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: { publicUrl } } = supabase.storage.from("car-covers").getPublicUrl(path);
    pixelCardUrl = publicUrl;
  } catch (err) {
    console.error("[cards/mint] image generation failed:", err);
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: `Couldn't mint your card. ${message}` }, { status: 500 });
  }

  // Derive a short "nickname" from the cardTitle for back-compat
  const nickname = body.cardTitle.split(" ").slice(0, 4).join(" ").slice(0, 60);

  // ── Insert pixel card ──────────────────────────────────────────────────
  const mintedAt = new Date().toISOString();
  const { data: cardRaw, error: insErr } = await supabase
    .from("pixel_cards")
    .insert({
      user_id: user.id,
      car_id: carId,
      car_snapshot: snapshot,
      pixel_card_url: pixelCardUrl,
      nickname,
      hp: body.estimatedPerformance.hp,
      mod_count: mods.length,
      minted_at: mintedAt,
      flavor_text: body.flavourText,
      era,
      occasion,
      rarity,
      is_public: isPublic,
      card_title: body.cardTitle.trim(),
      build_archetype: body.buildArchetype,
      estimated_performance: body.estimatedPerformance,
      ai_estimated_performance: body.aiEstimatedPerformance,
      build_aggression: body.buildAggression,
      uniqueness_score: body.uniquenessScore,
      authenticity_confidence: body.authenticityConfidence,
      traits: body.traits,
      flavour_text: body.flavourText,
      weaknesses: body.weaknesses,
      rival_archetypes: body.rivalArchetypes,
      status: "alive",
      personality,
      card_level: newCardLevel,
    })
    .select(
      "id, user_id, car_id, car_snapshot, pixel_card_url, nickname, hp, mod_count, minted_at, card_number, flavor_text, era, occasion, rarity, is_public, card_title, build_archetype, estimated_performance, ai_estimated_performance, build_aggression, uniqueness_score, authenticity_confidence, traits, flavour_text, weaknesses, rival_archetypes, battle_record",
    )
    .single();

  if (insErr || !cardRaw) {
    console.error("[cards/mint] insert failed:", insErr?.message);
    return NextResponse.json({ error: insErr?.message ?? "Failed to save card" }, { status: 500 });
  }

  // Opportunistic: queue a builder score recalc by touching the row.
  await supabase.rpc("touch_builder_score", { _user_id: user.id }).then(() => {}, () => {});

  console.log(`[cards/mint] minted card=${cardRaw.id} car=${carId} title="${body.cardTitle}"`);

  // ── Unused var silencer: anthropic is kept for future inline text tweaks ─
  void anthropic;

  return NextResponse.json({ card: cardRaw });
}
