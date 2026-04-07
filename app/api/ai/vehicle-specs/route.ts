import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
  car_id: z.string().uuid(),
});

/**
 * Response shape:
 * {
 *   stock:     { horsepower, torque, ... }           // factory baseline
 *   modified:  { horsepower, torque, ... }           // after installed mods
 *   mod_deltas: [ { name, category, hp, torque, weight, zero_to_sixty, top_speed } ]
 *   specs:      modified (written back to DB so the UI still works)
 * }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { data: carRaw } = await supabase
    .from("cars")
    .select("make, model, year, trim")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!carRaw) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  // Fetch installed mods — we feed the whole list to Claude so it can estimate
  // HP / torque / weight deltas per mod and sum them for the "modified" specs.
  const { data: modsRaw } = await supabase
    .from("mods")
    .select("name, category, notes")
    .eq("car_id", car_id)
    .eq("status", "installed");

  const mods = (modsRaw ?? []) as { name: string; category: string; notes: string | null }[];
  const modList = mods.length
    ? mods
        .map(
          (m, i) =>
            `${i + 1}. ${m.name} (${m.category})${m.notes ? ` — user notes: "${m.notes.slice(0, 150)}"` : ""}`
        )
        .join("\n")
    : "(no installed mods)";

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are an expert automotive tuner. Estimate the specs of a user's car — BOTH stock baseline and modified final figures.

Vehicle: ${carRaw.year} ${carRaw.make} ${carRaw.model}${carRaw.trim ? ` ${carRaw.trim}` : ""}

Installed mods:
${modList}

Instructions:
1. Look up the STOCK factory specs for this vehicle (HP, torque, 0-60, top speed, weight, drivetrain, engine, transmission).
2. For EACH mod, estimate its effect on HP, torque, curb weight, 0-60, and top speed. Use industry-typical figures:
   - cold air intake: +8 to +15hp, +5 to +12 lb-ft
   - cat-back exhaust: +10 to +20hp, +8 to +15 lb-ft
   - headers: +15 to +30hp
   - tune / ECU flash on stock turbo: +30 to +80hp
   - downpipe: +20 to +40hp
   - supercharger: +150 to +250hp (and more torque)
   - turbo upgrade: +100 to +250hp
   - coilovers: -10 to -25 lbs, negligible HP
   - lightweight wheels: -15 to -30 lbs per set
   - carbon hood / bumpers: -15 to -40 lbs total
   - carbon driveshaft: -10 lbs
   - big brake kit: +10 to +20 lbs (heavier) — document as weight GAIN
   - wider tires: slight 0-60 improvement (-0.05 to -0.1 sec)
3. If the user explicitly states numbers in the notes (e.g. "+20hp"), use THOSE exact numbers instead of your estimate.
4. Sum the deltas and compute modified 0-60 and top speed using the HP-to-acceleration heuristic (~0.02-0.04 sec 0-60 improvement per HP, small top speed gain).
5. Return JSON only — no markdown, no prose.

Return exactly this JSON shape:
{
  "stock": {
    "horsepower": <int or null>,
    "torque": <int lb-ft or null>,
    "engine_size": "<string or null>",
    "drivetrain": "<RWD|FWD|AWD|4WD or null>",
    "transmission": "<string or null>",
    "curb_weight": <int lbs or null>,
    "zero_to_sixty": <decimal seconds or null>,
    "top_speed": <int mph or null>
  },
  "modified": {
    "horsepower": <int>,
    "torque": <int>,
    "engine_size": "<string>",
    "drivetrain": "<string>",
    "transmission": "<string>",
    "curb_weight": <int>,
    "zero_to_sixty": <decimal>,
    "top_speed": <int>
  },
  "mod_deltas": [
    {
      "name": "<mod name>",
      "category": "<category>",
      "hp": <signed int or 0>,
      "torque": <signed int or 0>,
      "weight": <signed int or 0>,
      "zero_to_sixty": <signed decimal or 0>,
      "top_speed": <signed int or 0>,
      "note": "<one-line explanation>"
    }
  ]
}

Use null (not 0) for stock fields you genuinely don't know. For "modified", always provide numbers (fall back to stock if no mod affects that field).`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    type SpecPayload = {
      stock: {
        horsepower: number | null;
        torque: number | null;
        engine_size: string | null;
        drivetrain: string | null;
        transmission: string | null;
        curb_weight: number | null;
        zero_to_sixty: number | null;
        top_speed: number | null;
      };
      modified: {
        horsepower: number;
        torque: number;
        engine_size: string;
        drivetrain: string;
        transmission: string;
        curb_weight: number;
        zero_to_sixty: number;
        top_speed: number;
      };
      mod_deltas: Array<{
        name: string;
        category: string;
        hp: number;
        torque: number;
        weight: number;
        zero_to_sixty: number;
        top_speed: number;
        note: string;
      }>;
    };

    let payload: SpecPayload;
    try {
      const cleaned = text
        .replace(/^```json\n?/i, "")
        .replace(/^```\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      payload = JSON.parse(cleaned) as SpecPayload;
    } catch (err) {
      console.error("[vehicle-specs] parse failed:", err, "\ntext:", text.slice(0, 400));
      return NextResponse.json({ error: "Failed to parse specs" }, { status: 500 });
    }

    // Save the modified figures to the cars table (keeping existing schema),
    // and return the full payload so the UI can render stock vs modified.
    const savable: Record<string, unknown> = {
      horsepower: payload.modified.horsepower,
      torque: payload.modified.torque,
      engine_size: payload.modified.engine_size,
      drivetrain: payload.modified.drivetrain,
      transmission: payload.modified.transmission,
      curb_weight: payload.modified.curb_weight,
      zero_to_sixty: payload.modified.zero_to_sixty,
      top_speed: payload.modified.top_speed,
      specs_ai_guessed: true,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("cars")
      .update(savable)
      .eq("id", car_id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[vehicle-specs] save failed:", updateError);
    }

    return NextResponse.json({
      specs: payload.modified,
      stock: payload.stock,
      modified: payload.modified,
      mod_deltas: payload.mod_deltas,
      saved: !updateError,
    });
  } catch (err) {
    console.error("Vehicle specs error:", err);
    return NextResponse.json({ error: "Failed to get specs. Please try again." }, { status: 500 });
  }
}
