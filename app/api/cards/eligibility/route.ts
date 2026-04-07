import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/cards/eligibility?carId=...
 *
 * Returns mint eligibility for a car.
 * Eligible when the car has ≥1 real photo. No cooldown.
 */

function isRealPhoto(url: string): boolean {
  return !url.includes("render") && !url.includes("pixel-card") && !url.includes("generate");
}

export interface CardEligibility {
  eligible: boolean;
  hasPhoto: boolean;
  realPhotoCount: number;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const carId = url.searchParams.get("carId");
  if (!carId) return NextResponse.json({ error: "carId required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: carRaw }, { data: photosRaw }] = await Promise.all([
    supabase
      .from("cars")
      .select("id")
      .eq("id", carId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("car_photos").select("url").eq("car_id", carId),
  ]);

  if (!carRaw) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  const photos = (photosRaw ?? []) as { url: string }[];
  const realPhotoCount = photos.filter((p) => isRealPhoto(p.url)).length;
  const hasPhoto = realPhotoCount >= 1;
  const eligible = hasPhoto;

  return NextResponse.json({
    eligible,
    hasPhoto,
    realPhotoCount,
  } satisfies CardEligibility);
}
