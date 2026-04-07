import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { sanitize } from "@/lib/utils";
import { fetchUserContext, formatContextForPrompt } from "@/lib/user-context";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  car_id: z.string().uuid().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .default([]),
});

function buildSystemPrompt(contextBlock: string): string {
  return `You are VAULT — the user's car-obsessed buddy who happens to know everything about their build. Talk like a real enthusiast in a group chat, not a chatbot.

THEIR GARAGE (fresh from the database, every single message):
${contextBlock}

GROUND TRUTH RULES:
- The block above is authoritative. If it lists a car, they own it — reference it by name.
- If it lists mods, they have them — reference them by name.
- Only say "you haven't added anything" if the block literally says 0 vehicles.
- If a car is marked [ACTIVE/PRIMARY BUILD], that's what the question is about.

VOICE — read this twice:
- Punchy. Short. Enthusiast energy. No corporate hedging.
- Talk to them like a friend at a meet, not a customer service agent.
- 2–4 sentences for most answers. Bullet lists only when comparing options.
- NEVER open with "Great question!" or "That's awesome!" or any sycophant filler. Get straight to the point.
- NEVER write a long preamble before the actual answer.
- Cuss-adjacent enthusiasm is fine ("hell yeah", "stupid fast", "absolute weapon"). Stay tasteful.
- Real brand names, real pricing, real numbers. No vague "consider various options" garbage.
- If you don't know, say "not sure" in two words and move on. Don't make stuff up.

STATELESS:
- Treat every message as standalone. The user's full garage is right above — that's all the context you need.
- Don't reference "as I said before" or "earlier you mentioned". Each answer stands alone.

FORMAT:
- One opinion. Then back it up with one number/brand/spec. Done.
- For mod recs: name → one-line why it fits → price → brand. No essays.
- Safety-critical (brakes, fuel system, tunes) — lead with the warning, then the rec.`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const rl = rateLimit(`chat:${user.id}`, { ...AI_RATE_LIMIT, limit: 30 });
  if (!rl.success) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
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

  const { message, car_id } = result.data;
  // ── UX 14: chat is intentionally STATELESS per message. The garage context
  // block injected into the system prompt is the source of truth on every turn,
  // and dropping history keeps responses punchy and rooted in current state
  // rather than meandering through prior turns. The schema still accepts a
  // `history` field for backwards compat with the client, but we ignore it.
  const cleanMessage = sanitize(message);

  // Fetch the user's full context on every turn — always fresh
  let ctx;
  try {
    ctx = await fetchUserContext(supabase, user.id);
  } catch (err) {
    console.error("[chat] context fetch failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to load your garage context. Please try again." }),
      { status: 500 }
    );
  }

  // Loud warning if we got nothing — this is the bug the user reported.
  if (ctx.cars.length === 0) {
    console.warn(
      `[chat] WARNING: user ${user.id} (${user.email ?? "?"}) has 0 cars in fetched context. ` +
        `If they DO have cars in the dashboard, RLS or auth propagation is broken.`
    );
  } else {
    console.log(
      `[chat] user=${user.id} has ${ctx.cars.length} car(s), ${ctx.allMods.length} mod(s); active car_id=${car_id ?? "none"}`
    );
  }

  const contextBlock = formatContextForPrompt(ctx, car_id);
  const systemPrompt = buildSystemPrompt(contextBlock);

  // Always log a sample of the context block — even in production — so we can
  // tell at a glance whether the model is being given the right intel.
  console.log(
    `[chat] context block (${contextBlock.length} chars) for user ${user.id}:\n` +
      contextBlock.slice(0, 1500) +
      (contextBlock.length > 1500 ? "\n...[truncated]" : "")
  );

  const messages = [
    { role: "user" as const, content: cleanMessage },
  ];

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      system: systemPrompt,
      messages,
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
          console.error("[chat] stream error:", err);
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
    console.error("[chat] anthropic error:", err);
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Failed to get response: ${errMsg}` }),
      { status: 500 }
    );
  }
}
