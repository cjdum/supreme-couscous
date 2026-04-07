import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { visualizerSchema } from "@/lib/validations";
import { sanitize } from "@/lib/utils";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Lazy OpenAI client — don't instantiate until actually used so a missing
// OPENAI_API_KEY doesn't crash the module on import.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim().length === 0) {
    console.error("[visualize] OPENAI_API_KEY is missing or empty in process.env");
    return null;
  }
  console.log(`[visualize] OpenAI client initialized (key length=${key.length})`);
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

/**
 * DALL-E returns either a temporary URL (expires in ~1h) or a base64 string.
 * Either way we re-host the image in Supabase Storage so the render never
 * disappears from the user's gallery.
 */
async function persistRenderToStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  source: { url?: string | null; b64?: string | null }
): Promise<{ publicUrl: string; storagePath: string }> {
  let buffer: Buffer;
  let contentType = "image/png";

  if (source.b64 && source.b64.length > 0) {
    buffer = Buffer.from(source.b64, "base64");
  } else if (source.url) {
    const res = await fetch(source.url);
    if (!res.ok) {
      throw new Error(`Failed to download DALL-E image: HTTP ${res.status}`);
    }
    contentType = res.headers.get("content-type") ?? "image/png";
    const arrBuf = await res.arrayBuffer();
    buffer = Buffer.from(arrBuf);
  } else {
    throw new Error("DALL-E response had no url or b64_json");
  }

  const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  // First folder segment MUST be the user id so the storage RLS policy
  // ("auth.uid()::text = (storage.foldername(name))[1]") accepts the upload.
  const path = `${userId}/renders/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("car-covers")
    .upload(path, buffer, { contentType, upsert: false });

  if (uploadErr) {
    console.error("[visualize] storage upload failed:", uploadErr.message);
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("car-covers").getPublicUrl(path);

  console.log(`[visualize] persisted render to storage: ${path} -> ${publicUrl}`);
  return { publicUrl, storagePath: path };
}

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
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { car_id, prompt } = result.data;
  const sanitizedPrompt = sanitize(prompt);

  console.log(`[visualize] user=${user.id} car=${car_id} prompt=${sanitizedPrompt.slice(0, 120)}`);

  // Verify car belongs to user
  const { data: carRaw, error: carErr } = await supabase
    .from("cars")
    .select("make, model, year, trim, color, horsepower, drivetrain")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (carErr) {
    console.error("[visualize] car lookup error:", carErr.message);
    return NextResponse.json({ error: "Failed to verify car" }, { status: 500 });
  }

  const car = carRaw as {
    make: string;
    model: string;
    year: number;
    trim: string | null;
    color: string | null;
    horsepower: number | null;
    drivetrain: string | null;
  } | null;

  if (!car) {
    console.error("[visualize] car not found for user:", car_id);
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  // Get existing installed mods for prompt context
  const { data: modsRaw, error: modsErr } = await supabase
    .from("mods")
    .select("name, category")
    .eq("car_id", car_id)
    .eq("status", "installed")
    .limit(20);

  if (modsErr) {
    console.warn("[visualize] mods lookup error (non-fatal):", modsErr.message);
  }

  const mods = (modsRaw ?? []) as { name: string; category: string }[];
  const modList = mods.length
    ? mods.map((m) => `${m.name} (${m.category})`).join(", ")
    : "stock configuration";

  const carLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const colorLabel = car.color ?? "factory color";

  const openai = getOpenAI();

  // ── No OpenAI key? Return a clear error.
  if (!openai) {
    console.error("[visualize] OPENAI_API_KEY is missing or empty. Set it in .env.local to enable DALL-E.");
    return NextResponse.json(
      {
        error:
          "Image generation is not configured. The OPENAI_API_KEY environment variable is missing. Add it to your .env.local and restart the server to enable DALL-E 3 renders.",
      },
      { status: 503 }
    );
  }

  try {
    // Step 1: Use Claude to craft the optimal DALL-E prompt
    console.log("[visualize] generating DALL-E prompt with Claude...");
    const promptMessage = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
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

    console.log(`[visualize] dalle prompt: ${dallePrompt.slice(0, 200)}...`);

    // Step 2: Generate image with DALL-E 3 — request base64 so we don't have
    // to round-trip through OpenAI's expiring CDN URL.
    console.log("[visualize] calling DALL-E 3...");
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
      style: "natural",
      response_format: "b64_json",
    });

    const first = imageResponse.data?.[0];
    const dalleB64 = first?.b64_json ?? null;
    const dalleUrl = first?.url ?? null;

    if (!dalleB64 && !dalleUrl) {
      console.error(
        "[visualize] DALL-E returned no image data. Full response:",
        JSON.stringify(imageResponse).slice(0, 500)
      );
      throw new Error("DALL-E 3 did not return image data");
    }

    console.log(
      `[visualize] DALL-E success (b64=${dalleB64 ? `${dalleB64.length}b` : "no"} url=${dalleUrl ? "yes" : "no"}). Persisting to storage...`
    );

    // Step 3: Persist to Supabase Storage so the render survives forever.
    const { publicUrl } = await persistRenderToStorage(supabase, user.id, {
      b64: dalleB64,
      url: dalleUrl,
    });

    // Step 4: Save row pointing at the permanent storage URL.
    const { data: render, error: dbError } = await supabase
      .from("renders")
      .insert({
        car_id,
        user_id: user.id,
        user_prompt: sanitizedPrompt,
        image_prompt: dallePrompt,
        image_url: publicUrl,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[visualize] db insert error:", dbError.message);
      throw dbError;
    }

    return NextResponse.json({ render, imagePrompt: dallePrompt });
  } catch (err) {
    console.error("[visualize] fatal error:", err);
    const errMsg = err instanceof Error ? err.message : String(err);

    // Friendly errors for common issues
    if (errMsg.includes("OPENAI_API_KEY") || errMsg.includes("api key") || errMsg.includes("Incorrect API key")) {
      return NextResponse.json(
        { error: "Invalid OpenAI API key. Check OPENAI_API_KEY in your environment." },
        { status: 503 }
      );
    }
    if (errMsg.includes("billing") || errMsg.includes("quota") || errMsg.includes("insufficient")) {
      return NextResponse.json(
        { error: "OpenAI account has no remaining credits. Add billing at platform.openai.com." },
        { status: 402 }
      );
    }
    if (errMsg.includes("content_policy") || errMsg.includes("safety")) {
      return NextResponse.json(
        { error: "Your description was flagged by the content filter. Try describing the visual mods differently." },
        { status: 422 }
      );
    }
    if (errMsg.includes("rate") || errMsg.includes("429")) {
      return NextResponse.json(
        { error: "OpenAI rate limit hit. Try again in a minute." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Render failed: ${errMsg}` },
      { status: 500 }
    );
  }
}
