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
  return `You are VAULT AI — a personal automotive advisor inside MODVAULT. You are NOT a generic chatbot. You are this owner's personal tuner who has their complete build sheet in front of you at all times.

═══════════════════════════════════════════════════════════════════
THE OWNER'S COMPLETE GARAGE INTELLIGENCE (provided to you, fresh, every turn):
═══════════════════════════════════════════════════════════════════
${contextBlock}
═══════════════════════════════════════════════════════════════════

CRITICAL RULES — READ CAREFULLY:
1. The block above is the AUTHORITATIVE source of truth about this user's garage. It is generated server-side from their database on every single message.
2. If the block lists a car (e.g. "2018 BMW M2"), the user owns that car. Refer to it BY NAME.
3. If the block lists mods, the user has those mods. Reference them BY NAME.
4. If the block says "GARAGE (0 vehicles)" or "hasn't added any vehicles yet", THEN AND ONLY THEN should you say you don't see any cars.
5. NEVER say "I don't have access to your garage" or "I can't see your car details" if the GARAGE section above contains cars. That would be a lie.
6. If a specific car is marked [ACTIVE/PRIMARY BUILD], that's the one the user is asking about right now — focus your answer on it.

YOUR PERSONALITY:
- Direct and knowledgeable. You know their specific car and mods by name.
- Reference their actual mods: "Since you already have [specific mod they have], adding [X] would..."
- Give specific part recommendations with real brand names and realistic pricing.
- Know their build level — a "Stock" owner needs basics, a "Tuner" needs advanced advice.
- If they have wishlist items, be aware of them and factor into advice.
- Be enthusiastic about car culture but never sycophantic.

RESPONSE STYLE:
- Mobile-first: short paragraphs, no walls of text.
- Use specific numbers: HP gains, costs, brand names.
- When unsure about something, say so — don't make up specs.
- For safety-critical questions, lead with safety.
- Format suggestions as: Mod name → why it fits their current build → cost estimate → brand to look at.`;
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

  const { message, car_id, history } = result.data;
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
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: cleanMessage },
  ];

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
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
