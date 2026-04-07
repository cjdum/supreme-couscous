import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateBuildScore } from "@/lib/build-score";

/**
 * GET /api/user/context
 * Returns the authenticated user's full context:
 * - profile (username, display_name, bio, avatar_url)
 * - all cars with every mod (name, category, cost, date, status, notes)
 * - vehicle specs per car
 * - build score (level, score, breakdown)
 * - primary car id
 * - forum activity counts
 *
 * Used by: AI chat, AI suggestions, visualizer — single source of truth.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Profile
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  // 2. All cars with specs
  const { data: carsRaw } = await supabase
    .from("cars")
    .select(
      "id, make, model, year, trim, color, nickname, cover_image_url, is_public, is_primary, " +
      "horsepower, torque, engine_size, drivetrain, transmission, curb_weight, zero_to_sixty, top_speed, " +
      "specs_ai_guessed, created_at"
    )
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  const cars = (carsRaw ?? []) as unknown as Array<{
    id: string; make: string; model: string; year: number; trim: string | null;
    color: string | null; nickname: string | null; cover_image_url: string | null;
    is_public: boolean; is_primary: boolean | null;
    horsepower: number | null; torque: number | null; engine_size: string | null;
    drivetrain: string | null; transmission: string | null; curb_weight: number | null;
    zero_to_sixty: number | null; top_speed: number | null;
    specs_ai_guessed: boolean; created_at: string;
  }>;

  // 3. All mods across all cars
  const carIds = cars.map((c) => c.id);
  let allMods: Array<{
    id: string; car_id: string; name: string; category: string; cost: number | null;
    install_date: string | null; shop_name: string | null; is_diy: boolean;
    notes: string | null; status: string; created_at: string;
  }> = [];

  if (carIds.length > 0) {
    const { data: modsRaw } = await supabase
      .from("mods")
      .select("id, car_id, name, category, cost, install_date, shop_name, is_diy, notes, status, created_at")
      .in("car_id", carIds)
      .order("created_at", { ascending: false });
    allMods = (modsRaw ?? []) as typeof allMods;
  }

  // 4. Forum stats
  const [postResult, replyResult] = await Promise.all([
    supabase
      .from("forum_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("forum_replies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);
  const forumPostCount = postResult.count ?? 0;
  const forumReplyCount = replyResult.count ?? 0;

  // 5. Build score
  const buildScore = calculateBuildScore({
    cars,
    mods: allMods,
    forumPostCount,
    forumReplyCount,
  });

  // 6. Primary car
  const primaryCar = cars.find((c) => c.is_primary) ?? cars[0] ?? null;

  // 7. Group mods by car
  const modsByCarId = new Map<string, typeof allMods>();
  for (const mod of allMods) {
    if (!modsByCarId.has(mod.car_id)) modsByCarId.set(mod.car_id, []);
    modsByCarId.get(mod.car_id)!.push(mod);
  }

  const carsWithMods = cars.map((car) => ({
    ...car,
    mods: modsByCarId.get(car.id) ?? [],
  }));

  return NextResponse.json({
    profile: profileRaw ?? null,
    cars: carsWithMods,
    primaryCarId: primaryCar?.id ?? null,
    buildScore,
    forumPostCount,
    forumReplyCount,
  });
}
