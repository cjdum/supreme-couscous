import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
  assistant_reply: z.string().min(1).max(4000),
});

/**
 * POST /api/ai/chat/suggestions
 *
 * Given the latest assistant reply, return 2-3 contextual quick-reply buttons
 * the user could tap. These show up below each assistant message.
 *
 * Returns: { suggestions: string[] }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`chat-suggestions:${user.id}`, { ...AI_RATE_LIMIT, limit: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = bodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { assistant_reply } = result.data;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are generating 2-3 quick-reply suggestions for a car modding chat app. Given the assistant's last reply, suggest 2-3 short, natural follow-up questions the user might tap next.

Rules:
- Each suggestion is 3-8 words max.
- Make them specific to what the assistant just said.
- If the assistant mentioned a specific mod, suggest questions like "How much does it cost?", "Where to buy it?", "Add to my wishlist".
- If the assistant asked a clarifying question, suggest natural answers.
- Return ONLY a JSON array of strings. No explanation.

Assistant reply:
"""
${assistant_reply.slice(0, 2000)}
"""

Output example: ["How much does it cost?","Where can I buy it?","Add it to my wishlist"]`,
        },
      ],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text.trim() : "[]";

    let suggestions: string[] = [];
    try {
      const cleaned = text
        .replace(/^```json\n?/i, "")
        .replace(/^```\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length <= 80)
          .slice(0, 3);
      }
    } catch {
      suggestions = [];
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[chat-suggestions] error:", err);
    return NextResponse.json({ suggestions: [] });
  }
}
