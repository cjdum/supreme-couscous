/**
 * Shared helper to fetch the authenticated user's full context.
 *
 * Single source of truth used by:
 *   - /api/user/context (public endpoint for client-side fetching)
 *   - /api/ai/chat      (system prompt assembly)
 *   - /api/ai/suggestions
 *   - /api/ai/analyze-image
 *   - /api/ai/visualize
 *
 * Changing this shape changes what every AI-powered feature sees about the user.
 */
import type { createClient } from "@/lib/supabase/server";
import { calculateBuildScore, type BuildScoreResult } from "@/lib/build-score";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export interface ContextProfile {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export interface ContextCar {
  id: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  color: string | null;
  nickname: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  is_primary: boolean | null;
  horsepower: number | null;
  torque: number | null;
  engine_size: string | null;
  drivetrain: string | null;
  transmission: string | null;
  curb_weight: number | null;
  zero_to_sixty: number | null;
  top_speed: number | null;
  specs_ai_guessed: boolean;
  created_at: string;
  mods: ContextMod[];
}

export interface ContextMod {
  id: string;
  car_id: string;
  name: string;
  category: string;
  cost: number | null;
  install_date: string | null;
  shop_name: string | null;
  is_diy: boolean;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface UserContext {
  profile: ContextProfile | null;
  cars: ContextCar[];
  allMods: ContextMod[];
  primaryCarId: string | null;
  buildScore: BuildScoreResult;
  forumPostCount: number;
  forumReplyCount: number;
}

/**
 * Fetch the complete context for a user. Logs every step and counts so we can
 * see exactly what's coming back from Supabase in dev.
 */
export async function fetchUserContext(
  supabase: SupabaseServer,
  userId: string,
  opts: { log?: boolean } = {}
): Promise<UserContext> {
  const log = opts.log ?? true;
  const startedAt = Date.now();

  // 1. Profile
  const { data: profileRaw, error: profileErr } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (log && profileErr) {
    console.error("[user-context] profile error:", profileErr.message);
  }
  const profile = (profileRaw ?? null) as ContextProfile | null;

  // 2. Cars
  const { data: carsRaw, error: carsErr } = await supabase
    .from("cars")
    .select(
      "id, make, model, year, trim, color, nickname, cover_image_url, is_public, is_primary, " +
      "horsepower, torque, engine_size, drivetrain, transmission, curb_weight, zero_to_sixty, " +
      "top_speed, specs_ai_guessed, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (log && carsErr) {
    console.error("[user-context] cars error:", carsErr.message);
  }
  // Cast through unknown — supabase's string-concat select hint loses type
  // inference, and the project convention (per CLAUDE.md) is explicit casts.
  const carRows = (carsRaw ?? []) as unknown as Omit<ContextCar, "mods">[];

  // 3. Mods (in a single query across all car ids)
  const carIds = carRows.map((c) => c.id);
  let modsRaw: ContextMod[] = [];

  if (carIds.length > 0) {
    const { data: modData, error: modsErr } = await supabase
      .from("mods")
      .select(
        "id, car_id, name, category, cost, install_date, shop_name, is_diy, notes, status, created_at"
      )
      .in("car_id", carIds)
      .order("created_at", { ascending: false });

    if (log && modsErr) {
      console.error("[user-context] mods error:", modsErr.message);
    }
    modsRaw = (modData ?? []) as ContextMod[];
  }

  // 4. Forum counts (parallel)
  const [postRes, replyRes] = await Promise.all([
    supabase
      .from("forum_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("forum_replies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);
  const forumPostCount = postRes.count ?? 0;
  const forumReplyCount = replyRes.count ?? 0;

  // 5. Group mods by car_id for fast lookup
  const modsByCarId = new Map<string, ContextMod[]>();
  for (const mod of modsRaw) {
    const arr = modsByCarId.get(mod.car_id);
    if (arr) {
      arr.push(mod);
    } else {
      modsByCarId.set(mod.car_id, [mod]);
    }
  }

  // 6. Attach mods to each car and sort primary first
  const cars: ContextCar[] = carRows
    .map((car) => ({
      ...car,
      mods: modsByCarId.get(car.id) ?? [],
    }))
    .sort((a, b) => {
      if (a.is_primary === true && b.is_primary !== true) return -1;
      if (a.is_primary !== true && b.is_primary === true) return 1;
      return 0;
    });

  // 7. Primary car id
  const primaryCarId = cars.find((c) => c.is_primary)?.id ?? cars[0]?.id ?? null;

  // 8. Build score
  const buildScore = calculateBuildScore({
    cars,
    mods: modsRaw,
    forumPostCount,
    forumReplyCount,
  });

  if (log) {
    const elapsed = Date.now() - startedAt;
    const installedCount = modsRaw.filter((m) => m.status === "installed").length;
    console.log(
      `[user-context] user=${userId} cars=${cars.length} mods=${modsRaw.length} installed=${installedCount} posts=${forumPostCount} replies=${forumReplyCount} score=${buildScore.score} in ${elapsed}ms`
    );
    if (cars.length > 0) {
      console.log(
        "[user-context] cars:",
        cars.map((c) => `${c.year} ${c.make} ${c.model} (${c.mods.length} mods${c.is_primary ? ", primary" : ""})`).join(" | ")
      );
    }
  }

  return {
    profile,
    cars,
    allMods: modsRaw,
    primaryCarId,
    buildScore,
    forumPostCount,
    forumReplyCount,
  };
}

/**
 * Build a plain-text car description used in AI prompts.
 */
export function formatCarForPrompt(car: ContextCar): string {
  const name = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}${
    car.nickname ? ` ("${car.nickname}")` : ""
  }`;
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
  if (specs.length) {
    out += `    Specs: ${specs.join(", ")}${car.specs_ai_guessed ? " (AI-estimated)" : ""}\n`;
  }

  if (installed.length > 0) {
    out += `    Installed mods (${installed.length}${
      totalSpend > 0 ? `, $${totalSpend.toLocaleString()} total` : ""
    }):\n`;
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

/**
 * Assemble the full system prompt intel block used by the chat.
 * Includes the owner's name, build score, and every car+mod.
 */
export function formatContextForPrompt(
  ctx: UserContext,
  activeCarId?: string
): string {
  const userName = ctx.profile?.display_name || ctx.profile?.username || "the user";

  if (ctx.cars.length === 0) {
    return `${userName} is new to MODVAULT and hasn't added any vehicles yet.`;
  }

  const primary = activeCarId
    ? ctx.cars.find((c) => c.id === activeCarId)
    : ctx.cars.find((c) => c.is_primary) ?? ctx.cars[0] ?? null;

  const bs = ctx.buildScore;
  let out = `OWNER: ${userName}\n`;
  out += `BUILD SCORE: ${bs.score} pts — Level "${bs.level}"${
    bs.nextLevel ? ` (${(bs.nextThreshold ?? 0) - bs.score} pts to ${bs.nextLevel})` : " (MAX LEVEL)"
  }\n`;
  out += `GARAGE (${ctx.cars.length} vehicle${ctx.cars.length > 1 ? "s" : ""}):\n`;

  if (primary && ctx.cars.length > 1) {
    out += `[ACTIVE/PRIMARY BUILD]\n`;
    out += formatCarForPrompt(primary);
    const others = ctx.cars.filter((c) => c.id !== primary.id);
    if (others.length > 0) {
      out += `\n[OTHER VEHICLES IN GARAGE]\n`;
      for (const car of others) out += formatCarForPrompt(car);
    }
  } else if (primary) {
    out += formatCarForPrompt(primary);
  } else {
    for (const car of ctx.cars) out += formatCarForPrompt(car);
  }

  return out;
}
