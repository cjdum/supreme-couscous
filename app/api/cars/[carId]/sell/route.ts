import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ carId: string }>;
}

/**
 * POST /api/cars/[carId]/sell
 *
 * Retire a car from the active garage. Sets is_sold=true, sold_at=now().
 * The car (and its pixel card) will surface under "Past Builds" on the
 * owner's profile. This replaces hard delete.
 */
export async function POST(_req: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("cars")
    .update({ is_sold: true, sold_at: now, updated_at: now })
    .eq("id", carId)
    .eq("user_id", user.id)
    .eq("is_sold", false)
    .select("id, is_sold, sold_at")
    .maybeSingle();

  if (error) {
    console.error("[sell] update failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Car not found or already sold." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, sold_at: now });
}
