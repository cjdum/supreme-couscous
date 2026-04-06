import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { sanitize } from "@/lib/utils";
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
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), { status: 429 });
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

  // Build context about user's garage
  let carContext = "";
  if (car_id) {
    const { data: carRaw } = await supabase
      .from("cars")
      .select("make, model, year, trim, color, horsepower, torque, engine_size, drivetrain")
      .eq("id", car_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (carRaw) {
      const { data: modsRaw } = await supabase
        .from("mods")
        .select("name, category, cost, status")
        .eq("car_id", car_id)
        .limit(30);

      const installed = (modsRaw ?? []).filter((m) => m.status === "installed");
      const wishlist = (modsRaw ?? []).filter((m) => m.status === "wishlist");

      carContext = `
The user's current car context:
Vehicle: ${carRaw.year} ${carRaw.make} ${carRaw.model}${carRaw.trim ? ` ${carRaw.trim}` : ""}${carRaw.color ? ` (${carRaw.color})` : ""}
${carRaw.horsepower ? `Stock HP: ${carRaw.horsepower} hp` : ""}
${carRaw.torque ? `Torque: ${carRaw.torque} lb-ft` : ""}
${carRaw.engine_size ? `Engine: ${carRaw.engine_size}` : ""}
${carRaw.drivetrain ? `Drivetrain: ${carRaw.drivetrain}` : ""}

Installed mods (${installed.length}): ${installed.map((m) => `${m.name} (${m.category})`).join(", ") || "none yet"}
Wishlist (${wishlist.length}): ${wishlist.map((m) => m.name).join(", ") || "empty"}
`;
    }
  } else {
    // Get a summary of all user's cars
    const { data: carsRaw } = await supabase
      .from("cars")
      .select("make, model, year, nickname")
      .eq("user_id", user.id)
      .limit(5);

    if (carsRaw && carsRaw.length > 0) {
      carContext = `\nUser's garage: ${carsRaw
        .map((c) => `${c.year} ${c.make} ${c.model}${c.nickname ? ` "${c.nickname}"` : ""}`)
        .join(", ")}`;
    }
  }

  const systemPrompt = `You are VAULT AI, an expert automotive advisor and performance tuning specialist inside the MODVAULT app. You have deep knowledge of car modifications, performance tuning, motorsports, and car culture.

Your personality: knowledgeable, direct, and enthusiastic about cars. You give specific, actionable advice. When recommending parts, provide estimated costs and mention reputable brands.

${carContext}

Guidelines:
- Keep responses concise and practical
- Use technical terms correctly but explain them when needed
- When suggesting mods, mention estimated costs and brands
- For performance questions, provide specific numbers when possible
- If asked about safety, always prioritize safety
- Format with short paragraphs for readability on mobile`;

  const messages = [
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: cleanMessage },
  ];

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
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
          console.error("Stream error:", err);
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
    console.error("Chat error:", err);
    return new Response(JSON.stringify({ error: "Failed to get response. Please try again." }), { status: 500 });
  }
}
