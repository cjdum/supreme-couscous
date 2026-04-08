import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import {
  lookupStockSpecs,
  estimateModdedHp,
  estimateModdedTorque,
  estimateModdedZeroToSixty,
  estimateModdedTopSpeed,
} from "@/lib/vehicle-specs";
import { calculateBuilderScore } from "@/lib/builder-score";
import { evaluateTraits, type TraitInput } from "@/lib/traits";
import type { EstimatedPerformance, CardTrait } from "@/lib/supabase/types";

/**
 * POST /api/cards/generate
 *
 * Assembles all inputs for a card, calls Claude, and returns generated data
 * WITHOUT saving. The user then reviews, edits, and confirms before minting
 * via /api/cards/mint.
 *
 * IMPORTANT:
 *   - No images are ever passed to the AI. All car understanding comes from
 *     typed text fields.
 *   - Performance numbers are grounded in stock spec baselines + realistic
 *     mod delta estimates.
 *   - Card titles pass existing titles per user so the AI doesn't repeat.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Shape the AI returns
interface GeneratedCardData {
  cardTitle: string;
  buildArchetype: string;
  estimatedPerformance: EstimatedPerformance;
  buildAggression: number;
  uniquenessScore: number;
  authenticityConfidence: number;
  cardTraits: string[];
  flavourText: string;
  weaknesses: string[];
  rivalArchetypes: string[];
}

// Rough validation — we trust shape but clamp numerics.
function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`cards-generate:${user.id}`, { ...AI_RATE_LIMIT, limit: 6 });
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
  const occasion = (body.occasion ?? "").trim().slice(0, 100);
  if (!carId) return NextResponse.json({ error: "carId required" }, { status: 400 });

  // ── 1. Load car + profile + minted card titles so far ───────────────────
  const { data: carRaw } = await supabase
    .from("cars")
    .select(
      "id, user_id, make, model, year, trim, color, nickname, description, horsepower, torque, zero_to_sixty, top_speed, drivetrain, vin_verified, created_at",
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
    trim: string | null;
    color: string | null;
    nickname: string | null;
    description: string | null;
    horsepower: number | null;
    torque: number | null;
    zero_to_sixty: number | null;
    top_speed: number | null;
    drivetrain: string | null;
    vin_verified: boolean;
    created_at: string;
  } | null;

  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });
  if (!car.trim?.trim() || !car.color?.trim()) {
    return NextResponse.json(
      { error: "Fill in your car's trim and color before generating a card." },
      { status: 400 },
    );
  }

  // ── 2. Mods with full documentation detail ──────────────────────────────
  const { data: modsRaw } = await supabase
    .from("mods")
    .select("name, category, cost, install_date, notes, shop_name, is_diy")
    .eq("car_id", carId)
    .eq("status", "installed");
  type ModRow = {
    name: string;
    category: string;
    cost: number | null;
    install_date: string | null;
    notes: string | null;
    shop_name: string | null;
    is_diy: boolean;
  };
  const mods = (modsRaw ?? []) as ModRow[];
  const totalInvested = mods.reduce((s, m) => s + (m.cost ?? 0), 0);

  // ── 2b. Mod photo counts ────────────────────────────────────────────────
  const { data: modPhotoCountsRaw } = await supabase
    .from("mod_photos")
    .select("mod_id")
    .eq("car_id", carId);
  const modPhotoCounts: Record<string, number> = {};
  for (const row of (modPhotoCountsRaw ?? []) as { mod_id: string }[]) {
    modPhotoCounts[row.mod_id] = (modPhotoCounts[row.mod_id] ?? 0) + 1;
  }

  // ── 2c. Car photos ──────────────────────────────────────────────────────
  const { data: carPhotosRaw } = await supabase
    .from("car_photos")
    .select("id")
    .eq("car_id", carId);
  const photoCount = (carPhotosRaw ?? []).length;

  // ── 3. Stock spec lookup ────────────────────────────────────────────────
  const stock = await lookupStockSpecs(supabase, car.year, car.make, car.model, car.trim);

  // Derive modded performance from stock baseline + mod heuristics
  const hpNow = estimateModdedHp(stock.hp ?? car.horsepower, mods) ?? stock.hp ?? car.horsepower ?? 250;
  const hpDelta = (stock.hp ?? car.horsepower) ? hpNow - (stock.hp ?? car.horsepower!) : 0;
  const deltaPct = stock.hp && hpNow ? (hpNow - stock.hp) / stock.hp : 0;
  const torqueNow = estimateModdedTorque(stock.torque ?? car.torque, deltaPct) ?? stock.torque ?? car.torque ?? 250;
  const zeroNow =
    estimateModdedZeroToSixty(stock.zero_to_sixty ?? car.zero_to_sixty, hpDelta) ??
    stock.zero_to_sixty ??
    car.zero_to_sixty ??
    6.0;
  const topSpeedNow =
    estimateModdedTopSpeed(stock.top_speed ?? car.top_speed, hpDelta) ??
    stock.top_speed ??
    car.top_speed ??
    150;

  // ── 4. Builder Score for this user (rough, without full recalc) ─────────
  // Pull just enough to compute the score inputs.
  const { data: userCardsRaw } = await supabase
    .from("pixel_cards")
    .select("id, card_title, authenticity_confidence")
    .eq("user_id", user.id);
  type UserCardRow = { id: string; card_title: string | null; authenticity_confidence: number | null };
  const userCards = (userCardsRaw ?? []) as UserCardRow[];

  const builderScore = calculateBuilderScore({
    mods: mods.map((m) => ({
      cost: m.cost,
      install_date: m.install_date,
      notes: m.notes,
      photo_count: 0, // cheap pass — full recalc has proper per-mod photo counts
    })),
    cards: userCards.map((c) => ({
      authenticity_confidence: c.authenticity_confidence,
      weighted_rating: null,
      endorsement_weight: 0,
      flag_weight: 0,
    })),
    flag_accuracy: 0.5,
    created_at: car.created_at,
    vin_verified: car.vin_verified,
    average_received_rating: null,
    active_days_30d: 0,
    installed_mod_count: mods.length,
  });

  // ── 5. Build the AI prompt (text-only!) ─────────────────────────────────
  const existingTitles = userCards
    .map((c) => c.card_title)
    .filter((t): t is string => !!t && t.trim().length > 0);

  const stockLine = stock.matched
    ? `Stock baseline (from database${stock.exact ? ", exact match" : ", nearest match"}): ${stock.hp} hp, ${stock.torque} lb-ft, ${stock.zero_to_sixty}s 0-60, ${stock.top_speed} mph top speed, ${stock.weight ?? "?"} lb`
    : `Stock baseline: UNKNOWN — the exact ${car.year} ${car.make} ${car.model} ${car.trim ?? ""} is not in our lookup table. Give conservative estimates and reflect this uncertainty in authenticityConfidence.`;

  const modLine = mods.length
    ? mods
        .map((m) => {
          const parts: string[] = [`${m.category}: ${m.name}`];
          if (m.cost != null) parts.push(`$${m.cost}`);
          if (m.install_date) parts.push(m.install_date);
          if (m.notes) parts.push(`notes: ${m.notes.slice(0, 120)}`);
          if (m.shop_name) parts.push(m.shop_name);
          if (m.is_diy) parts.push("DIY");
          return `- ${parts.join(" · ")}`;
        })
        .join("\n")
    : "- (no installed mods)";

  const platformTenureDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(car.created_at).getTime()) / 86_400_000),
  );

  const systemPrompt = `You are a credible car-community judge evaluating a build for a collectible card game. You are NOT a hype machine. You are respected, skeptical, fair, and detail-oriented — think Hagerty meets Speedhunters meets a tough-but-honest friend at a Cars & Coffee.

You will receive ONLY typed data about a vehicle. You do NOT see any photo. Your analysis must be grounded in the numbers and stated mod list. Do NOT speculate about visual qualities you cannot verify.

You return STRICT JSON matching the schema below. No preamble, no trailing prose, no markdown fences — only the JSON object.

{
  "cardTitle":            string (3-5 words, evocative, SPECIFIC to this build, NEVER a generic "[Name]'s [Car]" pattern, NEVER reuse any title in the user's existing list),
  "buildArchetype":       string (one of: "Track Weapon", "Show Stopper", "Sleeper", "Street Brawler", "Daily Driven", "Restomod", "Stance Build", "Time Attack", "Cruiser", "Drift Build", "Grand Tourer", "Rally Build", "Show & Go", "Hypermiler"),
  "estimatedPerformance": { "hp": int, "torque": int, "zero_to_sixty": number (seconds, one decimal), "top_speed": int (mph) },
  "buildAggression":      int (1-10, how aggressive/focused the build is — 1 factory, 10 purpose-built),
  "uniquenessScore":      int (0-100, how uncommon is this specific combination),
  "authenticityConfidence": int (0-100, YOUR confidence that the claimed mods + performance are real and achievable — factor in documentation, photo count, tenure, VIN status, stock spec match),
  "cardTraits":           array of strings drawn from this list: ["Authenticated", "Builder", "Respected", "Veteran", "Specialist", "Sleeper", "Show Quality", "Community Pick", "Controversial"] — only include the ones you are confident apply. No new traits.
  "flavourText":          string (1-2 sentences, poetic but grounded — no "beast", "monster", "powerhouse", "legend", or "unleash"),
  "weaknesses":           array of 1-3 short strings (genuine weak points — e.g., "Bolt-on power with no suspension upgrade", "Documentation gaps on fuel system"),
  "rivalArchetypes":      array of 1-3 archetype strings this build would struggle against
}

Hard rules:
- If stock baseline is UNKNOWN, lower authenticityConfidence to 35–55 and keep performance estimates conservative.
- Performance numbers must be within realistic range of (stock_hp × (1 + reasonable_mod_delta)).
- buildArchetype must match the actual mod list — don't call a pure suspension build a "Track Weapon".
- cardTitle must NOT repeat or lightly vary any entry in the "existing_titles" list.`;

  const userPrompt = `Vehicle: ${car.year} ${car.make} ${car.model}${car.trim ? " " + car.trim : ""}
Color: ${car.color}
Drivetrain: ${car.drivetrain ?? "unknown"}
VIN verified: ${car.vin_verified ? "yes" : "no"}
User description: ${(car.description ?? "").slice(0, 500) || "(none)"}
Owner platform tenure: ${platformTenureDays} days
Owner builder score: ${builderScore.composite_score} (${builderScore.tier_label})

${stockLine}

Installed mods (${mods.length}, total invested $${totalInvested}):
${modLine}

Car photos on file: ${photoCount}

Existing card titles this user has minted (MUST NOT repeat or lightly vary):
${existingTitles.length ? existingTitles.map((t) => `- ${t}`).join("\n") : "(none)"}

Occasion note (frozen on card): ${occasion || "(none)"}

Assembled fallback performance from stock + heuristics (you may override slightly if justified):
- hp: ${hpNow}
- torque: ${torqueNow}
- zero_to_sixty: ${zeroNow}
- top_speed: ${topSpeedNow}

Return the strict JSON now.`;

  // ── 6. Call Claude ──────────────────────────────────────────────────────
  let parsed: GeneratedCardData;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 900,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    // Strip accidental ```json fences just in case
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(clean) as GeneratedCardData;
  } catch (err) {
    console.error("[cards/generate] AI call or JSON parse failed:", err);
    return NextResponse.json({ error: "Card generation failed. Try again." }, { status: 500 });
  }

  // ── 7. Clamp & sanitize ─────────────────────────────────────────────────
  const estimated: EstimatedPerformance = {
    hp: clamp(parsed.estimatedPerformance.hp, 50, 3000),
    torque: clamp(parsed.estimatedPerformance.torque, 50, 3000),
    zero_to_sixty: Math.round((parsed.estimatedPerformance.zero_to_sixty || 6) * 10) / 10,
    top_speed: clamp(parsed.estimatedPerformance.top_speed, 60, 400),
  };

  // ── 8. Derive our own trait evaluation (AI suggests, we verify) ─────────
  const modsForTraits = mods.map((m) => ({
    cost: m.cost,
    install_date: m.install_date,
    notes: m.notes,
    photo_count: 0,
    category: m.category,
  }));

  const traitInput: TraitInput = {
    vin_verified: car.vin_verified,
    mods: modsForTraits,
    average_rating: null,
    has_enough_respected_raters: false,
    owner_tenure_days: platformTenureDays,
    owner_card_count: userCards.length,
    hp_delta: stock.hp ? hpNow - stock.hp : null,
    zero_to_sixty_delta: stock.zero_to_sixty && zeroNow ? zeroNow - stock.zero_to_sixty : null,
    stock_hp: stock.hp,
    photo_count: photoCount,
    presence_average: null,
    is_community_pick: false,
    endorsement_weight: 0,
    flag_weight: 0,
  };
  const traits: CardTrait[] = evaluateTraits(traitInput);

  return NextResponse.json({
    // What the user will review
    cardTitle: parsed.cardTitle,
    buildArchetype: parsed.buildArchetype,
    estimatedPerformance: estimated,
    aiEstimatedPerformance: estimated, // original AI output — pinned for authenticity check
    buildAggression: clamp(parsed.buildAggression ?? 5, 1, 10),
    uniquenessScore: clamp(parsed.uniquenessScore ?? 50, 0, 100),
    authenticityConfidence: clamp(parsed.authenticityConfidence ?? 60, 0, 100),
    traits, // use OUR trait evaluation (verifiable) — not the AI's freeform list
    flavourText: (parsed.flavourText ?? "").slice(0, 300),
    weaknesses: (parsed.weaknesses ?? []).slice(0, 3),
    rivalArchetypes: (parsed.rivalArchetypes ?? []).slice(0, 3),
    // Context shown in review UI
    stockSpecs: {
      hp: stock.hp,
      torque: stock.torque,
      zero_to_sixty: stock.zero_to_sixty,
      top_speed: stock.top_speed,
      weight: stock.weight,
      matched: stock.matched,
      exact: stock.exact,
    },
    builderScore: {
      composite: builderScore.composite_score,
      tier: builderScore.tier_label,
    },
  });
}
