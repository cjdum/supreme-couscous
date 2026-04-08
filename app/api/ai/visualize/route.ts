import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { visualizerSchema } from "@/lib/validations";
import { sanitize } from "@/lib/utils";

// NOTE: image analysis is DISABLED for the visualizer per the ModVault spec.
// All car understanding must come from typed text fields — not from user
// photos. The old describeReferencePhoto() helper has been kept only for
// historical reference and is never called.

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

// NOTE: describeReferencePhoto() was removed intentionally.
// Per the ModVault spec, the visualizer never passes user images to an AI.
// All car understanding now comes from typed fields only.

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

  // IMPORTANT: per the ModVault spec, we no longer pass ANY user image to
  // an AI (vision or otherwise). All car understanding comes from typed
  // fields — year, make, model, trim, color, drivetrain, installed mods.
  // Every generation call is STATELESS — no image history, no descriptors,
  // no reference photos of any kind. The old reference-photo logic is
  // removed so the prompt can't quietly regress to describing an image.

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
    // Step 1: Compose a DEDUCTIVE text-only DALL-E prompt.
    //
    // Every ModVault generation is STATELESS — the prompt is built fresh each
    // time from typed fields, and the year is a HARD CONSTRAINT. We explicitly
    // forbid "classic", "vintage", or older body styles so DALL-E cannot drift
    // toward earlier generations of the same nameplate.
    //
    // We still use Claude to polish the prompt, but with a tight JSON-shaped
    // instruction so it can't drift into freeform hypercar territory.
    console.log("[visualize] composing text-only DALL-E prompt with Claude...");
    const promptMessage = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 420,
      messages: [
        {
          role: "user",
          content: `Write one photorealistic DALL-E 3 prompt for an automotive render. The prompt must be CONSTRAINED to a specific vehicle and era. You are NOT given an image and must NOT invent one. Base the prompt only on the typed fields below.

═══ HARD CONSTRAINTS — never violate these ═══
- Subject vehicle: ${carLabel}
- Vehicle YEAR: ${car.year}  (the render must show the ${car.year} body style — NOT any earlier generation)
- Exterior color: ${colorLabel}
${car.drivetrain ? `- Drivetrain: ${car.drivetrain}\n` : ""}${car.horsepower ? `- Power: ${car.horsepower} hp\n` : ""}- Only the mods listed below may be visually applied. Do NOT add aftermarket parts that weren't listed.
- No hypercars. No Koenigseggs. No fantasy body kits. No generic supercar substitution.
- No text, no license plates, no watermarks, no people.

═══ INSTALLED MODS (the only visual departures from stock allowed) ═══
${modList}

═══ USER SCENE/LIGHTING REQUEST ═══
${sanitizedPrompt}

═══ OUTPUT FORMAT ═══
Write ONE paragraph (90–170 words), starting LITERALLY with "A photorealistic photograph of a ${car.year} ${car.make} ${car.model}${car.trim ? " " + car.trim : ""} in ${colorLabel}, the ${car.year} body style". Then describe the stance, wheels, and details using the mods listed. Then describe the requested scene/lighting. End with "professional automotive photography, natural lighting, sharp focus, 3/4 angle". Output the prompt text only — no quotes, no labels, no explanation.`,
        },
      ],
    });

    let dallePrompt =
      promptMessage.content[0].type === "text"
        ? promptMessage.content[0].text.trim().replace(/^"|"$/g, "")
        : `A photorealistic photograph of a ${car.year} ${car.make} ${car.model}${car.trim ? " " + car.trim : ""} in ${colorLabel}, the ${car.year} body style, ${sanitizedPrompt}, professional automotive photography, natural lighting, sharp focus, 3/4 angle`;

    // Belt + suspenders: guarantee the year and "body style" phrase survive
    // even if Claude rewrites the opening.
    if (!dallePrompt.toLowerCase().includes(`${car.year}`)) {
      dallePrompt = `A photorealistic photograph of a ${car.year} ${car.make} ${car.model}${car.trim ? " " + car.trim : ""} in ${colorLabel}, the ${car.year} body style. ${dallePrompt}`;
    }
    if (!/body\s+style/i.test(dallePrompt)) {
      dallePrompt = dallePrompt.replace(
        new RegExp(`${car.year}\\s+${car.make}\\s+${car.model}`, "i"),
        `${car.year} ${car.make} ${car.model}, the ${car.year} body style`,
      );
    }

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
