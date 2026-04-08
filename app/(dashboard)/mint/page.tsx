import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MintStudio } from "@/components/mint/mint-studio";
import type { MintableCar } from "@/components/mint/mint-studio";
import type { MintedCard } from "@/lib/pixel-card";

export const metadata = { title: "Mint — MODVAULT" };

export default async function MintPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all cars
  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, year, make, model, trim, color, nickname, cover_image_url, is_primary")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  type CarRow = {
    id: string; year: number; make: string; model: string;
    trim: string | null; color: string | null; nickname: string | null;
    cover_image_url: string | null; is_primary: boolean;
  };
  const cars = (carsRaw ?? []) as CarRow[];

  if (cars.length === 0) redirect("/garage");

  // Fetch all pixel cards for this user, oldest-first so latest is last per car
  const { data: allCardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("minted_at", { ascending: true });
  const allCards = (allCardsRaw ?? []) as MintedCard[];

  // Group by car_id
  const cardsMap: Record<string, MintedCard[]> = {};
  for (const c of allCards) {
    const key = c.car_id ?? "";
    if (!key) continue;
    cardsMap[key] = cardsMap[key] ?? [];
    cardsMap[key].push(c);
  }

  // Build MintableCar list
  const mintableCars: MintableCar[] = cars.map((car) => ({
    id: car.id,
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim,
    color: car.color,
    nickname: car.nickname,
    cover_image_url: car.cover_image_url,
    is_primary: car.is_primary,
    cardCount: (cardsMap[car.id] ?? []).length,
    latestCard: (cardsMap[car.id] ?? []).at(-1) ?? null,
  }));

  return <MintStudio cars={mintableCars} />;
}
