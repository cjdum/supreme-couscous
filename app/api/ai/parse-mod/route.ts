import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
  text: z.string().min(2).max(1000),
  car_id: z.string().uuid().optional(),
});

/**
 * POST /api/ai/parse-mod
 *
 * Takes a free-form sentence like:
 *   "Injen cold air intake, $230, installed last week at SpeedZone, +12hp"
 *
 * Returns a structured ModInput-shaped object the client can drop straight
 * into the form. Mod NAME is the only field guaranteed to be non-null.
 * Everything else is best-effort and the user can edit before saving.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { text, car_id } = parsed.data;

  // Optional: pull the car so we can give Claude better context for ambiguous
  // mods (e.g. "tune" means very different things on different platforms).
  let carContext = "";
  if (car_id) {
    const { data: carRaw } = await supabase
      .from("cars")
      .select("make, model, year, trim")
      .eq("id", car_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (carRaw) {
      const c = carRaw as { make: string; model: string; year: number; trim: string | null };
      carContext = `The user owns a ${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ""}. Use this context if the input is ambiguous (e.g. "tune" → ECU tune for the platform).\n\n`;
    }
  }

  // Today, in ISO, so Claude can resolve "last week", "yesterday", etc. to
  // an actual install_date string.
  const today = new Date().toISOString().slice(0, 10);

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `${carContext}You parse free-form car-mod descriptions into a structured record.

Today's date is ${today}. Use it to resolve relative dates ("last week", "yesterday", "two months ago") into YYYY-MM-DD strings.

Input from the user:
"""
${text}
"""

Extract the following fields. Return JSON only — no markdown, no prose, no code fences.

{
  "name": "<the mod itself, brand + product if mentioned, e.g. 'Injen cold air intake' — REQUIRED>",
  "category": "<one of: engine, suspension, aero, interior, wheels, exhaust, electronics, other>",
  "cost": <number in USD or null if not stated>,
  "install_date": "<YYYY-MM-DD or null>",
  "shop_name": "<shop name or null>",
  "is_diy": <true if user mentioned DIY/self-installed, false otherwise>,
  "notes": "<everything that didn't fit elsewhere, including HP gains, part numbers, anecdotes — keep verbatim user voice; null if nothing extra>",
  "status": "<'installed' if past tense or any install signal, 'wishlist' if 'want', 'planning', 'looking at', etc.>"
}

Rules:
- name is REQUIRED. If you genuinely cannot identify a mod, return {"error":"no_mod_found"}.
- Pick the best-fitting category. Default to "other" only as a last resort.
- Currency symbols, commas, and "k" suffixes (e.g. "$1.2k") should be parsed: $1.2k = 1200.
- Don't invent details. If install date wasn't stated, return null — don't assume "today".
- "DIY", "self-install", "did it myself", "in my garage" → is_diy: true.
- Short inputs like just "Akrapovic exhaust" are valid — fill name + category, leave the rest null, status defaults to "installed".`,
        },
      ],
    });

    const text_out = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const cleaned = text_out
      .replace(/^```json\n?/i, "")
      .replace(/^```\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    type ParsedMod = {
      name?: string;
      category?: string;
      cost?: number | null;
      install_date?: string | null;
      shop_name?: string | null;
      is_diy?: boolean;
      notes?: string | null;
      status?: "installed" | "wishlist";
      error?: string;
    };

    let parsedOut: ParsedMod;
    try {
      parsedOut = JSON.parse(cleaned) as ParsedMod;
    } catch (err) {
      console.error("[parse-mod] JSON parse failed:", err, "\ntext:", text_out.slice(0, 300));
      return NextResponse.json({ error: "Couldn't understand that — try rewording." }, { status: 422 });
    }

    if (parsedOut.error || !parsedOut.name) {
      return NextResponse.json(
        { error: "Couldn't find a mod in that — try including a name." },
        { status: 422 }
      );
    }

    const validCategories = [
      "engine",
      "suspension",
      "aero",
      "interior",
      "wheels",
      "exhaust",
      "electronics",
      "other",
    ];
    const category = validCategories.includes(parsedOut.category ?? "")
      ? (parsedOut.category as string)
      : "other";

    return NextResponse.json({
      mod: {
        name: parsedOut.name,
        category,
        cost: typeof parsedOut.cost === "number" ? parsedOut.cost : null,
        install_date: parsedOut.install_date ?? null,
        shop_name: parsedOut.shop_name ?? null,
        is_diy: parsedOut.is_diy ?? false,
        notes: parsedOut.notes ?? null,
        status: parsedOut.status === "wishlist" ? "wishlist" : "installed",
      },
    });
  } catch (err) {
    console.error("[parse-mod] error:", err);
    return NextResponse.json({ error: "AI parse failed. Please try again." }, { status: 500 });
  }
}
