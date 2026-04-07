import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { visualizerSchema } from "@/lib/validations";
import { sanitize } from "@/lib/utils";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = visualizerSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const { car_id, prompt } = result.data;
  const sanitizedPrompt = sanitize(prompt);

  // Verify car belongs to user
  const { data: carRaw } = await supabase
    .from("cars")
    .select("make, model, year, trim, color, horsepower, drivetrain")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const car = carRaw as {
    make: string; model: string; year: number; trim: string | null;
    color: string | null; horsepower: number | null; drivetrain: string | null;
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
    : "stock configuration";

  const carLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const colorLabel = car.color ?? "factory color";

  try {
    // Step 1: Use Claude to craft the optimal DALL-E prompt from the user's description
    const promptMessage = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are an expert at writing DALL-E 3 image generation prompts for automotive photography.

Generate a single DALL-E 3 prompt for this car build visualization:

Car: ${carLabel} in ${colorLabel}
Existing mods: ${modList}
Requested look: ${sanitizedPrompt}

Requirements for the prompt:
- Photorealistic automotive photography style
- Studio lighting or dramatic outdoor setting
- Describe the car's specific modifications visually
- Include stance, wheel style, body kit details from the user's request
- Mention specific colors and finishes
- Professional car photography composition (3/4 angle or side profile)
- High detail, high contrast
- NO text, NO watermarks, NO people

Output ONLY the DALL-E prompt — no explanation, no quotes.`,
        },
      ],
    });

    const dallePrompt =
      promptMessage.content[0].type === "text"
        ? promptMessage.content[0].text.trim()
        : `Professional automotive photography of a modified ${carLabel}, ${sanitizedPrompt}, dramatic lighting, high detail`;

    // Step 2: Generate image with DALL-E 3
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
      style: "natural",
    });

    const imageUrl = imageResponse.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("DALL-E 3 did not return an image URL");
    }

    // Step 3: Save to database
    const imagePrompt = `${carLabel} — ${sanitizedPrompt}`;
    const { data: render, error: dbError } = await supabase
      .from("renders")
      .insert({
        car_id,
        user_id: user.id,
        user_prompt: sanitizedPrompt,
        image_prompt: dallePrompt,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ render, imagePrompt });
  } catch (err) {
    console.error("Visualize error:", err);
    const errMsg = err instanceof Error ? err.message : "Failed to generate visualization";

    // Friendly errors for common issues
    if (errMsg.includes("OPENAI_API_KEY") || errMsg.includes("api key")) {
      return NextResponse.json(
        { error: "Image generation is not configured. Add OPENAI_API_KEY to your environment." },
        { status: 503 }
      );
    }
    if (errMsg.includes("content_policy") || errMsg.includes("safety")) {
      return NextResponse.json(
        { error: "Your description was flagged by the content filter. Try describing the visual mods differently." },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate visualization. Please try again." },
      { status: 500 }
    );
  }
}
