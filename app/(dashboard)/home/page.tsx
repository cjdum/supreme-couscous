import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HomeCardHero } from "@/components/home/home-card-hero";

export const metadata = { title: "Home — MODVAULT" };

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch user's primary car
  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, year, make, model")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const primaryCar = (carsRaw ?? [])[0] as
    | { id: string; year: number; make: string; model: string }
    | undefined;

  if (!primaryCar) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-5 text-center gap-5">
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
          Add your car to get started.
        </p>
        <Link
          href="/garage"
          style={{
            height: 44,
            padding: "0 24px",
            borderRadius: 10,
            background: "#3B82F6",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "none",
          }}
        >
          Set up your garage
        </Link>
      </div>
    );
  }

  const carLabel = `${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`;

  // Fetch the user's living card (status='alive' — only one at a time)
  const { data: cardRaw } = await supabase
    .from("pixel_cards")
    .select("id, pixel_card_url")
    .eq("user_id", user.id)
    .eq("status", "alive")
    .maybeSingle();

  type CardRow = { id: string; pixel_card_url: string | null };
  const cardRow = cardRaw as CardRow | null;

  const card = cardRow
    ? { id: cardRow.id, pixel_card_url: cardRow.pixel_card_url }
    : null;

  return (
    <HomeCardHero
      card={card}
      carLabel={carLabel}
      cardId={card?.id ?? null}
    />
  );
}
