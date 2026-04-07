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

/**
 * Download a reference image and use Claude's vision to describe its visual
 * characteristics (color nuance, stance, wheels visible, body condition),
 * so we can inject those details into the DALL-E prompt. DALL-E 3 can't take
 * image refs directly, so we launder the details through Claude.
 */
async function describeReferencePhoto(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mediaType =
      contentType.includes("png") ? "image/png" :
      contentType.includes("webp") ? "image/webp" :
      contentType.includes("gif") ? "image/gif" :
      "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    // Keep the description call cheap — skip huge files.
    if (buf.length > 4 * 1024 * 1024) return null;
    const b64 = buf.toString("base64");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 260,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: b64 },
            },
            {
              type: "text",
              text: `Describe this car photo in 3-4 concise sentences for an AI image generator. Focus ONLY on visual traits that should be preserved in a new render: exact paint color and finish (gloss/matte/pearl), wheel style/size/finish, stance and ride height, body kit presence, lighting characteristics, and notable exterior details. Do NOT describe the background. Output plain text, no preamble.`,
            },
          ],
        },
      ],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return text || null;
  } catch (err) {
    console.warn("[visualize] reference photo description failed:", err);
    return null;
  }
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

  // Fetch full car details — everything we need to describe the car accurately.
  const { data: carRaw, error: carErr } = await supabase
    .from("cars")
    .select("id, make, model, year, trim, color, nickname, horsepower, drivetrain, cover_image_url")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (carErr) {
    console.error("[visualize] car lookup error:", carErr.message);
    return NextResponse.json({ error: "Failed to verify car" }, { status: 500 });
  }

  const car = carRaw as {
    id: string;
    make: string;
    model: string;
    year: number;
    trim: string | null;
    color: string | null;
    nickname: string | null;
    horsepower: number | null;
    drivetrain: string | null;
    cover_image_url: string | null;
  } | null;

  if (!car) {
    console.error("[visualize] car not found for user:", car_id);
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  // Grab user-uploaded photos + most recent cover photo as reference.
  const { data: photosRaw } = await supabase
    .from("car_photos")
    .select("url, is_cover, position")
    .eq("car_id", car_id)
    .order("is_cover", { ascending: false })
    .order("position", { ascending: true })
    .limit(3);

  const photos = (photosRaw ?? []) as { url: string; is_cover: boolean; position: number }[];

  // Prefer user-uploaded car photos over generated renders for reference.
  const referenceUrl =
    photos.find((p) => p.is_cover)?.url ??
    photos[0]?.url ??
    car.cover_image_url ??
    null;

  // Get installed mods — we lead the DALL-E prompt with the actual build.
  const { data: modsRaw, error: modsErr } = await supabase
    .from("mods")
    .select("name, category, notes")
    .eq("car_id", car_id)
    .eq("status", "installed")
    .limit(25);

  if (modsErr) {
    console.warn("[visualize] mods lookup error (non-fatal):", modsErr.message);
  }

  const mods = (modsRaw ?? []) as { name: string; category: string; notes: string | null }[];
  const modList = mods.length
    ? mods.map((m) => `• ${m.name} (${m.category})${m.notes ? ` — ${m.notes.slice(0, 80)}` : ""}`).join("\n")
    : "• Stock / factory configuration";

  const carLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const colorLabel = car.color ?? "factory color";

  const openai = getOpenAI();
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
    // Step 1: If there's a user photo, describe it with Claude vision so we
    // can inject the visual traits into DALL-E's prompt.
    let referenceDescription: string | null = null;
    if (referenceUrl) {
      console.log(`[visualize] describing reference photo: ${referenceUrl.slice(0, 80)}`);
      referenceDescription = await describeReferencePhoto(referenceUrl);
      if (referenceDescription) {
        console.log(`[visualize] reference description: ${referenceDescription.slice(0, 180)}`);
      }
    }

    // Step 2: Use Claude to craft the optimal DALL-E prompt — LEADING with
    // the specific car (year/make/model/trim/color) so DALL-E doesn't invent a
    // random sports car. Previously DALL-E was producing Koenigseggs when the
    // user had a 911.
    console.log("[visualize] generating DALL-E prompt with Claude...");
    const promptMessage = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You write DALL-E 3 prompts for automotive photography. The goal is a PHOTOREALISTIC render that is clearly and specifically the user's exact car — not a generic sports car.

═══ USER'S CAR (must be recognizable in the output) ═══
Vehicle: ${carLabel}
Factory color: ${colorLabel}
${car.horsepower ? `Power: ${car.horsepower}hp\n` : ""}${car.drivetrain ? `Drivetrain: ${car.drivetrain}\n` : ""}
═══ INSTALLED MODS ═══
${modList}

${referenceDescription ? `═══ REAL REFERENCE PHOTO OF THIS EXACT CAR ═══\n${referenceDescription}\n` : ""}
═══ USER'S REQUESTED LOOK / SCENE ═══
${sanitizedPrompt}

═══ PROMPT REQUIREMENTS ═══
Your DALL-E prompt MUST:
1. LEAD with "A photorealistic photograph of a ${carLabel}" — never use a generic "sports car" phrase.
2. Explicitly state the make, model, year, trim${car.trim ? "" : " (if known)"}, and color. The car must be identifiable as this exact model from the render.
3. Preserve the body silhouette and signature styling cues of the ${car.make} ${car.model} — headlight shape, grille, greenhouse, rear taillight pattern.
4. Integrate the installed mods visually (wheels, kit, stance, exhaust, wrap, etc.).
${referenceDescription ? "5. Match the reference photo's paint color/finish, wheel style, and stance — these are real traits of this specific car.\n" : ""}6. Include the user's requested scene/lighting/setting.
7. Professional 3/4 or side-profile automotive photography, natural lighting, sharp focus, high detail.
8. NO text, NO watermarks, NO people, NO badging invention, NO generic supercar substitution.

Output ONLY the final DALL-E prompt (one paragraph, 80-160 words). No explanation, no quotes, no preamble.`,
        },
      ],
    });

    const dallePrompt =
      promptMessage.content[0].type === "text"
        ? promptMessage.content[0].text.trim().replace(/^"|"$/g, "")
        : `A photorealistic photograph of a ${carLabel} in ${colorLabel}, ${sanitizedPrompt}, dramatic lighting, high detail, 3/4 angle`;

    console.log(`[visualize] dalle prompt (${dallePrompt.length} chars): ${dallePrompt.slice(0, 240)}...`);

    // Step 3: Generate image with DALL-E 3 — request base64 so we don't have
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

    // Step 4: Persist to Supabase Storage so the render survives forever.
    const { publicUrl } = await persistRenderToStorage(supabase, user.id, {
      b64: dalleB64,
      url: dalleUrl,
    });

    // Step 5: Save row pointing at the permanent storage URL.
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
