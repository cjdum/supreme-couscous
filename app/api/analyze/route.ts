import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Rate limiting (in-memory, per serverless instance) ──────────────────────
const rateStore = new Map<string, { count: number; resetAt: number }>();

function checkRate(ip: string): { ok: boolean; minutesLeft?: number } {
  const now = Date.now();
  const WINDOW = 60 * 60 * 1000; // 1 hour
  const MAX = 3;
  const entry = rateStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateStore.set(ip, { count: 1, resetAt: now + WINDOW });
    return { ok: true };
  }
  if (entry.count >= MAX) {
    return { ok: false, minutesLeft: Math.ceil((entry.resetAt - now) / 60000) };
  }
  entry.count++;
  return { ok: true };
}

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(game?: string): string {
  const gameCtx = game
    ? `The player is playing **${game}**.`
    : `First identify the game from visual cues in the screenshot (HUD layout, art style, characters, fonts, UI elements).`;

  return `You are an expert gaming coach with encyclopedic knowledge of all video games.

${gameCtx}

Use web_search to find relevant guides, wiki pages, or strategies for the specific situation shown. Search for things like "[game] [mechanic/area/boss] guide" or "[game] tips [situation]".

Respond using EXACTLY these XML tags in this order:

<game>
${game ? game : "The game name you identified (include platform if visible)"}
</game>

<situation>
2-3 sentences: what is happening in this screenshot, current game state, location, player status.
</situation>

<next_steps>
- Most important action to take right now
- Second action
- Third action
</next_steps>

<missing>
- Something the player is overlooking based on what you see and guides you found
- A mechanic, item, or strategy relevant to this exact moment
- Another tip grounded in your research
</missing>

<warnings>
- Any immediate threat, danger, or critical mistake visible in the screenshot
(Only include genuine warnings — omit this section entirely if there are none)
</warnings>

Name actual items, abilities, locations, and enemies. Be specific. Ground your advice in real game knowledge and what you found via web search.`;
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* controller closed */ }
      };

      try {
        // Rate limit
        const { ok, minutesLeft } = checkRate(getIP(req));
        if (!ok) {
          send({ type: "error", text: `Rate limit reached — 3 requests per hour. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.` });
          controller.close();
          return;
        }

        const formData = await req.formData();
        const imageFile = formData.get("image") as File | null;
        const context = ((formData.get("context") as string) ?? "").trim();
        const game = ((formData.get("game") as string) ?? "").trim();

        if (!imageFile) {
          send({ type: "error", text: "No image provided." });
          controller.close();
          return;
        }

        send({ type: "status", text: "Analyzing screenshot…" });

        const bytes = await imageFile.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const mediaType = (imageFile.type || "image/jpeg") as
          | "image/png" | "image/jpeg" | "image/gif" | "image/webp";

        const userText = [
          game ? `I'm playing ${game}.` : null,
          context || "Analyze this screenshot and give me advice.",
        ].filter(Boolean).join(" ");

        const messages: Anthropic.MessageParam[] = [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: userText },
          ],
        }];

        let searchStatusSent = false;
        let safety = 0;

        // Streaming loop — handles pause_turn from server-side web search
        while (safety++ < 5) {
          const stream = client.messages.stream({
            model: "claude-opus-4-6",
            max_tokens: 2048,
            system: buildSystemPrompt(game || undefined),
            tools: [{ type: "web_search_20260209", name: "web_search" }],
            messages,
          });

          for await (const event of stream) {
            // Detect when web search starts
            if (
              event.type === "content_block_start" &&
              "content_block" in event &&
              (event.content_block as { type: string }).type === "server_tool_use" &&
              !searchStatusSent
            ) {
              send({ type: "status", text: "Searching game guides…" });
              searchStatusSent = true;
            }
            // Stream text deltas immediately
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send({ type: "delta", text: event.delta.text });
            }
          }

          const final = await stream.finalMessage();
          if (final.stop_reason !== "pause_turn") break;
          // pause_turn = server-side tool loop hit limit; re-send to continue
          messages.push({ role: "assistant", content: final.content });
        }

        send({ type: "done" });
      } catch (e) {
        let msg = "An unknown error occurred.";
        if (e instanceof Anthropic.AuthenticationError) {
          msg = "Invalid API key. Check ANTHROPIC_API_KEY in .env.local.";
        } else if (e instanceof Anthropic.RateLimitError) {
          msg = "Anthropic rate limit reached. Please wait a moment and try again.";
        } else if (e instanceof Anthropic.BadRequestError) {
          msg = e.message.includes("image") ? "Image too large or invalid format. Try a smaller screenshot." : `Bad request: ${e.message}`;
        } else if (e instanceof Anthropic.APIError) {
          msg = `API error (${e.status}): ${e.message}`;
        } else if (e instanceof Error) {
          msg = e.message;
        }
        send({ type: "error", text: msg });
      }

      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
