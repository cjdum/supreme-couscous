import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { sanitize } from "@/lib/utils";
import { calculateBuildScore } from "@/lib/build-score";
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

type CarWithMods = {
  id: string;
  make: string; model: string; year: number; trim: string | null;
  color: string | null; nickname: string | null;
  horsepower: number | null; torque: number | null; engine_size: string | null;
  drivetrain: string | null; transmission: string | null;
  curb_weight: number | null; zero_to_sixty: number | null; top_speed: number | null;
  cover_image_url: string | null; specs_ai_guessed: boolean; is_primary: boolean | null;
  mods: Array<{
    name: string; category: string; cost: number | null;
    install_date: string | null; status: string; notes: string | null;
    shop_name: string | null; is_diy: boolean;
  }>;
};

function buildCarDescription(car: CarWithMods): string {
  const name = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}${car.nickname ? ` ("${car.nickname}")` : ""}`;
  const color = car.color ? ` — ${car.color}` : "";

  const specs: string[] = [];
  if (car.horsepower) specs.push(`${car.horsepower} hp`);
  if (car.torque) specs.push(`${car.torque} lb-ft torque`);
  if (car.engine_size) specs.push(car.engine_size);
  if (car.drivetrain) specs.push(car.drivetrain);
  if (car.transmission) specs.push(car.transmission);
  if (car.curb_weight) specs.push(`${car.curb_weight} lbs`);
  if (car.zero_to_sixty) specs.push(`0-60 in ${car.zero_to_sixty}s`);
  if (car.top_speed) specs.push(`${car.top_speed} mph top speed`);

  const installed = car.mods.filter((m) => m.status === "installed");
  const wishlist = car.mods.filter((m) => m.status === "wishlist");
  const totalSpend = installed.reduce((s, m) => s + (m.cost ?? 0), 0);

  let out = `  • ${name}${color}\n`;
  if (specs.length) out += `    Specs: ${specs.join(", ")}${car.specs_ai_guessed ? " (AI-estimated)" : ""}\n`;

  if (installed.length > 0) {
    out += `    Installed mods (${installed.length}${totalSpend > 0 ? `, $${totalSpend.toLocaleString()} total` : ""}):\n`;
    for (const mod of installed) {
      const details: string[] = [mod.category];
      if (mod.cost) details.push(`$${mod.cost.toLocaleString()}`);
      if (mod.install_date) details.push(mod.install_date);
      if (mod.is_diy) details.push("DIY");
      if (mod.shop_name) details.push(`@${mod.shop_name}`);
      out += `      - ${mod.name} (${details.join(", ")})`;
      if (mod.notes) out += ` — "${mod.notes}"`;
      out += "\n";
    }
  } else {
    out += `    No mods installed yet (stock)\n`;
  }

  if (wishlist.length > 0) {
    out += `    Wishlist (${wishlist.length}): ${wishlist.map((m) => m.name).join(", ")}\n`;
  }

  return out;
}

async function fetchFullUserContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  // All cars
  const { data: carsRaw } = await supabase
    .from("cars")
    .select(
      "id, make, model, year, trim, color, nickname, cover_image_url, is_primary, " +
      "horsepower, torque, engine_size, drivetrain, transmission, curb_weight, zero_to_sixty, top_speed, specs_ai_guessed"
    )
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  const cars = (carsRaw ?? []) as unknown as Array<Omit<CarWithMods, "mods"> & { created_at?: string }>;

  // All mods
  let allMods: Array<{
    car_id: string; name: string; category: string; cost: number | null;
    install_date: string | null; status: string; notes: string | null;
    shop_name: string | null; is_diy: boolean;
  }> = [];

  const carIds = cars.map((c) => c.id);
  if (carIds.length > 0) {
    const { data: modsRaw } = await supabase
      .from("mods")
      .select("car_id, name, category, cost, install_date, status, notes, shop_name, is_diy")
      .in("car_id", carIds);
    allMods = (modsRaw ?? []) as typeof allMods;
  }

  // Build score
  const [postRes, replyRes] = await Promise.all([
    supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("forum_replies").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const buildScore = calculateBuildScore({
    cars,
    mods: allMods,
    forumPostCount: postRes.count ?? 0,
    forumReplyCount: replyRes.count ?? 0,
  });

  // Group mods by car
  const modsByCarId = new Map<string, typeof allMods>();
  for (const mod of allMods) {
    if (!modsByCarId.has(mod.car_id)) modsByCarId.set(mod.car_id, []);
    modsByCarId.get(mod.car_id)!.push(mod);
  }

  const carsWithMods: CarWithMods[] = cars.map((car) => ({
    ...car,
    mods: modsByCarId.get(car.id) ?? [],
  }));

  return { profile, carsWithMods, buildScore };
}

function buildSystemPrompt(
  profile: { username: string; display_name: string | null } | null,
  carsWithMods: CarWithMods[],
  buildScore: { score: number; level: string; nextLevel: string | null; nextThreshold: number | null },
  activeCarId?: string
): string {
  const userName = profile?.display_name || profile?.username || "the user";
  const primaryCar = activeCarId
    ? carsWithMods.find((c) => c.id === activeCarId)
    : carsWithMods.find((c) => c.is_primary) ?? carsWithMods[0] ?? null;

  let contextSection = "";

  if (carsWithMods.length === 0) {
    contextSection = `${userName} is new to MODVAULT and hasn't added any vehicles yet.`;
  } else {
    contextSection = `OWNER: ${userName}
BUILD SCORE: ${buildScore.score} pts — Level "${buildScore.level}"${buildScore.nextLevel ? ` (${buildScore.nextThreshold! - buildScore.score} pts to ${buildScore.nextLevel})` : " (MAX LEVEL)"}
GARAGE (${carsWithMods.length} vehicle${carsWithMods.length > 1 ? "s" : ""}):\n`;

    if (primaryCar && carsWithMods.length > 1) {
      contextSection += `[ACTIVE/PRIMARY BUILD]\n`;
      contextSection += buildCarDescription(primaryCar);
      const others = carsWithMods.filter((c) => c.id !== primaryCar.id);
      if (others.length > 0) {
        contextSection += `\n[OTHER VEHICLES IN GARAGE]\n`;
        for (const car of others) {
          contextSection += buildCarDescription(car);
        }
      }
    } else if (primaryCar) {
      contextSection += buildCarDescription(primaryCar);
    } else {
      for (const car of carsWithMods) {
        contextSection += buildCarDescription(car);
      }
    }
  }

  return `You are VAULT AI — a personal automotive advisor inside MODVAULT. You are NOT a generic chatbot. You are this owner's personal tuner who has their complete build sheet in front of you at all times.

YOUR BUILD INTELLIGENCE:
${contextSection}

YOUR PERSONALITY:
- Direct and knowledgeable. You know their specific car and mods by name.
- Reference their actual mods: "Since you already have [specific mod they have], adding [X] would..."
- Give specific part recommendations with real brand names and realistic pricing.
- Know their build level — a "Stock" owner needs basics, a "Tuner" needs advanced advice.
- If they have wishlist items, be aware of them and factor into advice.
- Be enthusiastic about car culture but never sycophantic.
- If asked what's in their garage, describe it accurately using the data above.

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

  // Fetch full user context for every session
  const { profile, carsWithMods, buildScore } = await fetchFullUserContext(supabase, user.id);

  const systemPrompt = buildSystemPrompt(profile, carsWithMods, buildScore, car_id);

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
