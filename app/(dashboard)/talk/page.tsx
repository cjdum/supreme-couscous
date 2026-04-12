import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CardTalk } from "@/components/card-talk/card-talk";
import type { MintedCard } from "@/lib/pixel-card";
import type { Car as CarType } from "@/lib/supabase/types";

export const metadata = { title: "Talk — MODVAULT" };

export default async function TalkPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Primary car
  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, make, model, year, is_primary")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const cars = (carsRaw ?? []) as CarType[];
  const primaryCar = cars.find((c) => c.is_primary) ?? cars[0] ?? null;

  if (!primaryCar) redirect("/garage");

  // Latest alive card
  const { data: cardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user.id)
    .eq("car_id", primaryCar.id)
    .eq("status", "alive")
    .order("minted_at", { ascending: false })
    .limit(1);
  const card = ((cardsRaw ?? []) as MintedCard[])[0] ?? null;

  if (!card) redirect("/mint");

  const carLabel = `${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`;

  return <CardTalk card={card} carLabel={carLabel} />;
}
