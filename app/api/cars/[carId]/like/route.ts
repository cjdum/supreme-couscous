import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ carId: string }>;
}

/**
 * POST /api/cars/[carId]/like — toggle like state for the current user.
 *
 * Idempotent: returns `{ liked: true }` after the call regardless of prior
 * state. DELETE removes the like. The car must be public; users cannot like
 * their own builds (vanity guard).
 */
export async function POST(_req: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: carRaw } = await supabase
    .from("cars")
    .select("id, user_id, is_public")
    .eq("id", carId)
    .maybeSingle();
  const car = carRaw as { id: string; user_id: string; is_public: boolean | null } | null;

  if (!car || !car.is_public) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 });
  }
  if (car.user_id === user.id) {
    return NextResponse.json({ error: "You can't like your own build" }, { status: 400 });
  }

  // Upsert via insert + ignore unique violation
  const { error } = await supabase
    .from("likes")
    .insert({ user_id: user.id, car_id: carId });

  // 23505 = unique_violation; treat as success (already liked)
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("likes")
    .select("id", { count: "exact", head: true })
    .eq("car_id", carId);

  return NextResponse.json({ liked: true, count: count ?? 0 });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("user_id", user.id)
    .eq("car_id", carId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await supabase
    .from("likes")
    .select("id", { count: "exact", head: true })
    .eq("car_id", carId);

  return NextResponse.json({ liked: false, count: count ?? 0 });
}
