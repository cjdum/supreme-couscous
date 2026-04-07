import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/cards/eligibility?carId=...
 *
 * Returns mint eligibility for a car.
 *   - hasPhoto: boolean (≥1 real photo)
 *   - cooldownRemainingMs: number (0 if ready)
 *   - eligible: boolean
 */

const COOLDOWN_HOURS = 72;
const COOLDOWN_MS    = COOLDOWN_HOURS * 60 * 60 * 1000;

function isRealPhoto(url: string): boolean {
  return !url.includes("render") && !url.includes("pixel-card") && !url.includes("generate");
}

export interface CardEligibility {
  eligible: boolean;
  hasPhoto: boolean;
  realPhotoCount: number;
  cooldownRemainingMs: number;
  cooldownRemainingHours: number;
  lastMintedAt: string | null;
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
      .select("id, last_card_minted_at")
      .eq("id", carId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("car_photos").select("url").eq("car_id", carId),
  ]);

  if (!carRaw) return NextResponse.json({ error: "Car not found" }, { status: 404 });
  const car = carRaw as { id: string; last_card_minted_at: string | null };

  const photos = (photosRaw ?? []) as { url: string }[];
  const realPhotoCount = photos.filter((p) => isRealPhoto(p.url)).length;
  const hasPhoto = realPhotoCount >= 1;

  let cooldownRemainingMs = 0;
  if (car.last_card_minted_at) {
    const last = new Date(car.last_card_minted_at).getTime();
    const elapsed = Date.now() - last;
    if (elapsed < COOLDOWN_MS) cooldownRemainingMs = COOLDOWN_MS - elapsed;
  }

  const cooldownRemainingHours = Math.ceil(cooldownRemainingMs / (60 * 60 * 1000));
  const eligible = hasPhoto && cooldownRemainingMs === 0;

  return NextResponse.json({
    eligible,
    hasPhoto,
    realPhotoCount,
    cooldownRemainingMs,
    cooldownRemainingHours,
    lastMintedAt: car.last_card_minted_at,
  } satisfies CardEligibility);
}
