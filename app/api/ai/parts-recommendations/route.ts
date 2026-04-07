import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { sanitize } from "@/lib/utils";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
  car_id: z.string().uuid(),
  /** Optional — when set, recommendations are scoped to this specific mod the user wants. */
  mod_name: z.string().min(1).max(120).optional(),
  mod_category: z
    .enum(["engine", "suspension", "aero", "interior", "wheels", "exhaust", "electronics", "other"])
    .optional(),
});

interface PartRecommendation {
  product: string;
  brand: string;
  partNumber: string | null;
  priceRange: string;
  fitsBecause: string;
  difficulty: "Bolt-on" | "Moderate" | "Advanced" | "Professional";
  pros: string[];
  cons: string[];
}

/**
 * POST /api/ai/parts-recommendations
 *
 * Returns 3-5 specific product recommendations from Claude for either:
 *   - The user's whole build (when only car_id is given)
 *   - A specific mod they want (when mod_name + mod_category are given)
 *
 * No affiliate links, no fake URLs — Claude returns real brand/part-number
 * intel based on its training data. The user copies the part number into
 * their own search.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`parts-rec:${user.id}`, AI_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
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
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { car_id, mod_name, mod_category } = result.data;
  const cleanModName = mod_name ? sanitize(mod_name) : null;

  // Verify car ownership and pull the details Claude needs to give specific recs.
  const { data: carRaw, error: carErr } = await supabase
    .from("cars")
    .select("make, model, year, trim, horsepower, torque, drivetrain, transmission, engine_size")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (carErr) {
    console.error("[parts-rec] car lookup:", carErr.message);
    return NextResponse.json({ error: "Failed to verify car" }, { status: 500 });
  }

  if (!carRaw) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  const car = carRaw as {
    make: string;
    model: string;
    year: number;
    trim: string | null;
    horsepower: number | null;
    torque: number | null;
    drivetrain: string | null;
    transmission: string | null;
    engine_size: string | null;
  };

  const { data: modsRaw } = await supabase
    .from("mods")
    .select("name, category, status")
    .eq("car_id", car_id)
    .limit(40);
  const allMods = (modsRaw ?? []) as { name: string; category: string; status: string }[];
  const installed = allMods.filter((m) => m.status === "installed");

  const carLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const specsLine = [
    car.engine_size,
    car.horsepower ? `${car.horsepower}hp` : null,
    car.torque ? `${car.torque}lb-ft` : null,
    car.drivetrain,
    car.transmission,
  ]
    .filter(Boolean)
    .join(" · ");

  const installedSummary =
    installed.length > 0
      ? installed.map((m) => `${m.name} (${m.category})`).join(", ")
      : "stock";

  // Two prompt modes — specific mod vs general next-step recommendations.
  const prompt = cleanModName
    ? `You are a senior automotive parts advisor. The owner of a ${carLabel} (${specsLine || "stock specs"}) wants to add this specific mod:

REQUESTED MOD: ${cleanModName}${mod_category ? ` (category: ${mod_category})` : ""}

CURRENT BUILD: ${installedSummary}

Recommend 4 specific products that fit this car. Use real brand names and real part numbers from your training data. If you don't actually know a part number, return null — DO NOT invent one.

Return STRICT JSON ONLY (no markdown, no prose) — an object with this shape:
{
  "recommendations": [
    {
      "product": "Full product name as you'd see on a parts site",
      "brand": "Brand name (e.g. KW, Bilstein, AEM, Whiteline)",
      "partNumber": "Real part number or null",
      "priceRange": "$XXX–$X,XXX (USD, realistic)",
      "fitsBecause": "1–2 sentence reason this specific product fits THIS specific car",
      "difficulty": "Bolt-on" | "Moderate" | "Advanced" | "Professional",
      "pros": ["short pro 1", "short pro 2"],
      "cons": ["short con 1", "short con 2"]
    }
  ]
}

Order the array best-fit first. 4 items only. Be concrete. Mention OEM compatibility, fitment notes, or known caveats in fitsBecause where relevant.`
    : `You are a senior automotive parts advisor. Recommend 5 high-impact next mods for this build.

CAR: ${carLabel} (${specsLine || "stock specs"})
CURRENT BUILD: ${installedSummary}

For each recommendation, suggest a specific product (real brand + real part number where possible).

Return STRICT JSON ONLY (no markdown, no prose) — an object with this shape:
{
  "recommendations": [
    {
      "product": "Full product name",
      "brand": "Real brand",
      "partNumber": "Real part number or null",
      "priceRange": "$XXX–$X,XXX (USD)",
      "fitsBecause": "1–2 sentence reason this fits this car at this stage of the build",
      "difficulty": "Bolt-on" | "Moderate" | "Advanced" | "Professional",
      "pros": ["pro 1", "pro 2"],
      "cons": ["con 1", "con 2"]
    }
  ]
}

5 items, ordered by impact-per-dollar. No fake part numbers — return null if you don't actually know one.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");

    let parsed: { recommendations?: PartRecommendation[] } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("[parts-rec] JSON parse failed. Raw text:", text.slice(0, 400), err);
      return NextResponse.json(
        { error: "Could not parse recommendations from Claude. Please try again." },
        { status: 500 }
      );
    }

    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

    return NextResponse.json({
      recommendations,
      car: { label: carLabel, specs: specsLine },
      mode: cleanModName ? "specific" : "general",
    });
  } catch (err) {
    console.error("[parts-rec] anthropic error:", err);
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Recommendations failed: ${errMsg}` }, { status: 500 });
  }
}
