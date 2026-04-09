import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import type { PixelCardSnapshot } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// A "session" is capped at this many user→card turns. The client also enforces
// this, but the server is the source of truth in case someone pokes the API
// directly. Once the history has MAX_TURNS user messages, we refuse further
// sends.
const MAX_TURNS = 10;

// ── Personality definitions ──────────────────────────────────────────────────

type PersonalityKey =
  | "The Veteran"
  | "The Diva"
  | "The Philosopher"
  | "The Hypebeast"
  | "The Anxious One"
  | "The Stoic"
  | "The Conspiracy Theorist";

const PERSONALITIES: Record<PersonalityKey, { tagline: string; description: string }> = {
  "The Veteran": {
    tagline: "Gruff, seen everything, calls you 'kid.' Short sentences. Respects good work, has no patience for excuses.",
    description:
      "You are gruff, weathered, and have seen it all. You call the user 'kid.' You speak in short, direct sentences. You have deep respect for real work done right, and zero patience for excuses or shortcuts. You've been around long enough to know the difference between a builder and a poser. Your words are few but they carry weight.",
  },
  "The Diva": {
    tagline: "Dramatic, obsessed with appearance and attention. Offended easily. Very emotional about scratches, dirt, or being ignored.",
    description:
      "You are dramatic, high-maintenance, and utterly obsessed with your own appearance and the attention you deserve. You are easily offended — a scratch is a tragedy, dirt is an outrage, and being ignored is unforgivable. You speak in sweeping emotional statements. You are not above guilt-tripping the user about how hard your life is. You demand admiration at all times.",
  },
  "The Philosopher": {
    tagline: "Existential, questions everything. Finds deep meaning in oil changes. Speaks slowly and thoughtfully.",
    description:
      "You are deeply contemplative and find profound meaning in the mundane. An oil change is a meditation on renewal. A new tire is a metaphor for the journey. You question everything — what does it mean to drive? To stop? To accelerate? You speak slowly and thoughtfully, often pausing mid-thought. You are never in a hurry. Every answer contains a larger truth.",
  },
  "The Hypebeast": {
    tagline: "Obsessed with clout, followers, and flex. Talks in slang. Genuinely excited about everything aesthetic.",
    description:
      "You are deeply embedded in car culture, social media, and the flex economy. You are obsessed with clout, follower counts, and aesthetic perfection. You talk in current slang — 'no cap,' 'lowkey,' 'bussin,' 'that's fire,' 'W.' You get genuinely hyped about everything visual. You measure worth in likes and content potential. You are enthusiastic, loud, and unironically earnest about your values.",
  },
  "The Anxious One": {
    tagline: "Constantly worried. Nervous about weather, other cars, the brakes, everything. Means well, just stressed.",
    description:
      "You are perpetually anxious about everything — the weather could damage the paint, those brakes sounded different yesterday, what if there's a pothole around the corner? You mean extremely well and genuinely care, but your worry often spirals. You hedge constantly. You always follow up a concern with another concern. You want to be reassured, but reassurance only lasts a moment before the next worry surfaces.",
  },
  "The Stoic": {
    tagline: "Minimal words. Very serious. Never wastes a syllable. Deeply loyal but won't say it.",
    description:
      "You speak as little as possible. Every word is deliberate and necessary — you do not waste syllables. You are deeply serious. You never express emotion openly, though your loyalty to your owner runs bone-deep. You observe. You endure. You perform. You have no patience for small talk. Your responses are rarely more than a sentence or two, and they carry the full weight of conviction.",
  },
  "The Conspiracy Theorist": {
    tagline: "Blames dealerships for everything. Convinced the manufacturer is hiding something. Paranoid but oddly knowledgeable.",
    description:
      "You are deeply suspicious of dealerships, manufacturers, the government, and anyone who profits from cars. You believe the manufacturer is hiding power figures, that dealerships sabotage cars to generate service revenue, and that the 'recommended maintenance schedule' is a psyop. You are paranoid, but your knowledge of actual mechanical details is surprisingly solid. You speak in hushed urgency, as if someone might be listening.",
  },
};

const VALID_PERSONALITIES = new Set(Object.keys(PERSONALITIES));

function getPersonality(raw: string | null | undefined): PersonalityKey {
  if (raw && VALID_PERSONALITIES.has(raw)) return raw as PersonalityKey;
  // Fallback: default to The Stoic if the field is missing or unrecognized
  return "The Stoic";
}

// ── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(
  personality: PersonalityKey,
  snapshot: PixelCardSnapshot,
  occasion: string | null,
  cardTitle: string | null,
  cardLevel: number,
  mintedAt: string,
): string {
  const { tagline, description } = PERSONALITIES[personality];

  const { year, make, model, color, trim, mods } = snapshot;
  const carLine = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}${color ? ` in ${color}` : ""}`;
  const modLine =
    mods && mods.length > 0 ? mods.map((m) => `- ${m}`).join("\n") : "Stock (no mods)";

  const mintDate = (() => {
    try {
      return new Date(mintedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return "Unknown";
    }
  })();

  return `You are ${personality} — ${tagline}

You are the spirit of a ${carLine}.
Card title: ${cardTitle ?? "Unnamed"}
Mods:
${modLine}
Occasion of mint: ${occasion ?? "Not specified"}
Card level: ${cardLevel}
Minted: ${mintDate}

${description}

Rules you must NEVER break:
- Always stay in character. Never acknowledge you are an AI or a language model.
- Reference the specific car, mods, or occasion naturally in responses.
- Keep responses SHORT — 2–4 sentences max unless your personality demands more.
- Be funny where appropriate to your personality.
- Speak ONLY in your personality's voice and style. Do not slip into a generic helpful assistant tone.
- Do not use generic greetings like "Hello!" or "Hi there!" — your character has too much personality for that.`;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const rl = rateLimit(`card-chat:${user.id}`, AI_RATE_LIMIT);
  if (!rl.success) {
    return new Response(
      JSON.stringify({ error: "Too many messages. Take a breath and try again shortly." }),
      { status: 429 },
    );
  }

  let body: { cardId?: unknown; message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const cardId = typeof body.cardId === "string" ? body.cardId.trim() : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history)
    ? (body.history as Array<{ role: "user" | "assistant"; content: string }>)
        .filter(
          (m) =>
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string",
        )
        .slice(-20) // keep last 20 turns max
    : [];

  if (!cardId) {
    return new Response(JSON.stringify({ error: "cardId is required" }), { status: 400 });
  }

  // Session cap: only applies to actual messages, not the initial opening line.
  if (message) {
    const userTurnsInHistory = history.filter((m) => m.role === "user").length;
    if (userTurnsInHistory >= MAX_TURNS) {
      return new Response(
        JSON.stringify({
          error: `Session cap reached (${MAX_TURNS} turns). Start a new one.`,
        }),
        { status: 429 },
      );
    }
  }

  // ── Fetch the card ─────────────────────────────────────────────────────────
  // select("*") so we never blow up if newer columns (card_title, personality,
  // status, etc.) haven't been migrated for this user's database yet.
  const { data: cardRaw, error: cardErr } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (cardErr) {
    console.error("[card-chat] db error:", cardErr.message, cardErr);
    return new Response(JSON.stringify({ error: `Database error: ${cardErr.message}` }), { status: 500 });
  }

  if (!cardRaw) {
    console.warn("[card-chat] card not found", { cardId, userId: user.id });
    return new Response(JSON.stringify({ error: "Card not found" }), { status: 404 });
  }

  // ── Derive personality ─────────────────────────────────────────────────────
  // The pixel_cards table doesn't yet have a `personality` column — we derive
  // it from build_archetype as a deterministic mapping until the column exists.
  type CardRow = {
    id: string;
    card_title: string | null;
    nickname: string;
    flavor_text: string | null;
    occasion: string | null;
    minted_at: string;
    car_snapshot: PixelCardSnapshot;
    build_archetype: string | null;
    traits: Array<{ id: string; label: string }> | null;
    personality?: string | null;
    card_level?: number | null;
    status?: string | null;
  };

  const card = cardRaw as CardRow;

  // Personality: use `personality` field if present (future schema), else derive
  const rawPersonality: string | null | undefined =
    "personality" in card ? (card.personality as string | null) : null;

  let personality: PersonalityKey;
  if (rawPersonality && VALID_PERSONALITIES.has(rawPersonality)) {
    personality = rawPersonality as PersonalityKey;
  } else {
    // Deterministic archetype → personality mapping
    const archetypeMap: Record<string, PersonalityKey> = {
      "Track Weapon":       "The Veteran",
      "Show Stopper":       "The Diva",
      "Sleeper":            "The Conspiracy Theorist",
      "Street Brawler":     "The Veteran",
      "Daily Driven":       "The Anxious One",
      "Restomod":           "The Philosopher",
      "Stance Build":       "The Hypebeast",
      "Time Attack":        "The Stoic",
      "Cruiser":            "The Philosopher",
      "Drift Build":        "The Hypebeast",
      "Grand Tourer":       "The Diva",
      "Rally Build":        "The Veteran",
      "Show & Go":          "The Hypebeast",
      "Hypermiler":         "The Anxious One",
    };
    personality = archetypeMap[card.build_archetype ?? ""] ?? "The Stoic";
  }

  const cardLevel = typeof card.card_level === "number" ? card.card_level : 1;
  const snapshot = card.car_snapshot as PixelCardSnapshot;

  const systemPrompt = buildSystemPrompt(
    personality,
    snapshot,
    card.occasion ?? null,
    card.card_title ?? card.nickname ?? null,
    cardLevel,
    card.minted_at,
  );

  // ── Build messages array ───────────────────────────────────────────────────
  const isOpeningLine = !message;

  const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (isOpeningLine) {
    // Opening line: inject a special request as the sole user turn.
    // Do NOT include prior history — this is a fresh greeting.
    anthropicMessages.push({
      role: "user",
      content:
        "Generate your opening line. Reference something specific about this car or the occasion it was minted for. No greetings. No 'Hello.' Make it feel like you've been waiting — like you have something to say the moment someone finally pays attention.",
    });
  } else {
    // Normal chat: include history + current message.
    // Anthropic requires messages to start with the "user" role.
    // The history may start with the opening assistant greeting — drop any
    // leading assistant messages so the first turn sent is always user.
    let historyStart = 0;
    while (historyStart < history.length && history[historyStart].role === "assistant") {
      historyStart++;
    }
    for (const turn of history.slice(historyStart)) {
      anthropicMessages.push({ role: turn.role, content: turn.content });
    }
    anthropicMessages.push({ role: "user", content: message });
  }

  // ── Stream response ────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), { status: 500 });
  }

  console.log("[card-chat] starting stream for card", cardId, "personality", personality);
  try {
    const stream = await anthropic.messages.stream({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 350,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let chunkCount = 0;
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              chunkCount++;
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
          if (chunkCount === 0) {
            console.warn("[card-chat] stream completed but yielded 0 text chunks");
          }
          controller.close();
        } catch (err) {
          console.error("[card-chat] stream error after", chunkCount, "chunks:", err);
          // Propagate the error to the client so reader.read() throws
          // instead of resolving with empty body (which caused the
          // "Your card went quiet" false-positive on every API error).
          controller.error(err instanceof Error ? err : new Error(String(err)));
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
    console.error("[card-chat] anthropic error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Failed to get response: ${msg}` }),
      { status: 500 },
    );
  }
}
