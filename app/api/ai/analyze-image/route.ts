import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { fetchUserContext, formatContextForPrompt } from "@/lib/user-context";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
  image_base64: z.string().min(100).max(10_000_000),
  media_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  car_id: z.string().uuid().optional(),
});

/**
 * POST /api/ai/analyze-image
 *
 * Streams Claude's image analysis as plain text chunks.
 * Automatically pulls the user's full context (cars + mods) so Claude knows
 * what they own without the user having to specify.
 *
 * Returns: text/plain stream (NOT JSON).
 * The client should read the stream and display text progressively.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const rl = rateLimit(`analyze:${user.id}`, AI_RATE_LIMIT);
  if (!rl.success) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
      status: 429,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const result = bodySchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
  }

  const { image_base64, media_type, car_id } = result.data;

  console.log(`[analyze-image] user=${user.id} car=${car_id ?? "none"} media=${media_type} size=${image_base64.length}`);

  // Pull full context so Claude knows the user's garage
  let contextBlock = "";
  try {
    const ctx = await fetchUserContext(supabase, user.id);
    if (ctx.cars.length > 0) {
      contextBlock = `\n\nYOUR OWNER'S GARAGE:\n${formatContextForPrompt(ctx, car_id)}`;
    }
  } catch (err) {
    console.warn("[analyze-image] context fetch failed (continuing without):", err);
  }

  const prompt = `You are an expert automotive analyst analyzing a car photo for a MODVAULT user.${contextBlock}

Analyze this image with expertise and specific detail. Write in a direct, knowledgeable voice — like a tuner friend looking at their car.

Structure your response in these sections:

## Identification
The year, make, and model. If you can't identify it precisely, state your best guess + why. If the user's garage context above shows a matching car, reference it.

## What I See
The visible modifications, stock parts, stance, wheel choice, color/finish, body style, and overall condition. Be specific — call out brand signatures when visible (Vossen wheels, Akrapovic exhaust, etc).

## State of the Build
A short 2-3 sentence overall assessment. Is this a clean OEM+ build? A track rat? A stance build? Work in progress?

## Recommended Next Mods
5 specific mod recommendations with:
- The mod name (specific brand/product where applicable)
- Category: engine / suspension / aero / interior / wheels / exhaust / electronics / other
- Why it fits what you see (reference the current state of the car)
- Rough cost range ($XXX-$X,XXX)
- Priority: high / medium / low

Use markdown formatting. Be concise but substantive. No fluff, no disclaimers.`;

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type,
                data: image_base64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } catch (err) {
          console.error("[analyze-image] stream error:", err);
          controller.enqueue(encoder.encode("\n\n*Analysis interrupted. Please try again.*"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("[analyze-image] fatal:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Image analysis failed: ${errMsg}` }),
      { status: 500 }
    );
  }
}
