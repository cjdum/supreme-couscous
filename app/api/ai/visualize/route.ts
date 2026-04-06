import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { visualizerSchema } from "@/lib/validations";
import { sanitize } from "@/lib/utils";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting
  const rl = rateLimit(`visualize:${user.id}`, AI_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // Validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = visualizerSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { car_id, prompt } = result.data;
  const sanitizedPrompt = sanitize(prompt);

  // Verify car belongs to user
  const { data: carRaw } = await supabase
    .from("cars")
    .select("make, model, year, trim, color")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const car = carRaw as {
    make: string; model: string; year: number; trim: string | null; color: string | null;
  } | null;

  if (!car) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  // Get existing installed mods for context
  const { data: modsRaw } = await supabase
    .from("mods")
    .select("name, category")
    .eq("car_id", car_id)
    .eq("status", "installed")
    .limit(20);
  const mods = (modsRaw ?? []) as { name: string; category: string }[];
  const modList = mods.length
    ? mods.map((m) => `${m.name} (${m.category})`).join(", ")
    : "stock";

  const carLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const colorLabel = car.color ?? "factory color";

  try {
    // Ask Claude to generate an SVG illustration of the modified car
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `You are an expert SVG automotive illustrator. Generate a clean, stylized SVG illustration of a modified car for a dark-themed web app.

Car: ${carLabel} in ${colorLabel}
Current mods: ${modList}
Desired new mods / look: ${sanitizedPrompt}

Requirements:
- viewBox="0 0 800 450"
- Dark background (#09090b or #111)
- Stylized side-profile or 3/4-angle car silhouette — use smooth bezier curves for the body
- Reflect the desired mods visually: e.g. lowered stance, wide body, spoiler, custom wheels, exhaust tips, splitter
- Color the car body to match or reflect requested color changes
- Add subtle ground shadow and highlights for depth
- Include a short text label at the bottom: car name + top 2-3 mods
- Use the electric blue accent color #3b82f6 for glows, wheel highlights, or trim accents
- Modern, premium aesthetic — minimalist but detailed
- No external resources, no <image> tags, pure SVG shapes only

Output ONLY the complete SVG element (starting with <svg and ending with </svg>). No explanation, no markdown, no code fences.`,
        },
      ],
    });

    const svgContent =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    if (!svgContent || !svgContent.startsWith("<svg")) {
      throw new Error("Claude did not return a valid SVG");
    }

    // Encode the SVG as a base64 data URI so it can be stored in image_url
    // and rendered with a standard <img> tag
    const svgBase64 = Buffer.from(svgContent, "utf-8").toString("base64");
    const imageUrl = `data:image/svg+xml;base64,${svgBase64}`;

    // Also store a human-readable prompt summary
    const imagePrompt = `SVG render: ${carLabel} — ${sanitizedPrompt}`;

    // Save to database
    const { data: render, error: dbError } = await supabase
      .from("renders")
      .insert({
        car_id,
        user_id: user.id,
        user_prompt: sanitizedPrompt,
        image_prompt: imagePrompt,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ render });
  } catch (err) {
    console.error("Visualize error:", err);
    return NextResponse.json(
      { error: "Failed to generate visualization. Please try again." },
      { status: 500 }
    );
  }
}
