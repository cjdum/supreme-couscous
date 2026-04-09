import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryCar } from "@/lib/supabase/get-primary-car";
import { MintPageClient } from "@/components/mint/mint-page-client";
import type { MintableCar, GhostCardInfo } from "@/components/mint/mint-studio";
import type { MintedCard } from "@/lib/pixel-card";

export const metadata = { title: "Mint — MODVAULT" };

type AnyCard = MintedCard & {
  status?: string;
  personality?: string | null;
  card_level?: number | null;
  card_title?: string | null;
  burned_at?: string | null;
  last_words?: string | null;
};

export default async function MintPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const primaryCar = await getPrimaryCar(supabase, user.id);
  if (!primaryCar) redirect("/garage");

  const { data: allCardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user.id)
    .eq("car_id", primaryCar.id)
    .order("minted_at", { ascending: true });
  const allCards = (allCardsRaw ?? []) as AnyCard[];

  // Alive = explicit `status='alive'`, or (for pre-migration accounts with
  // null status) the most recently minted card. Everything else is a ghost.
  const aliveCardRaw =
    allCards.find((c) => c.status === "alive") ?? allCards.at(-1) ?? null;

  const ghostCards = allCards
    .filter((c) => c.id !== aliveCardRaw?.id)
    .sort((a, b) => {
      const da = a.burned_at ? new Date(a.burned_at).getTime() : new Date(a.minted_at).getTime();
      const db = b.burned_at ? new Date(b.burned_at).getTime() : new Date(b.minted_at).getTime();
      return db - da;
    }) as GhostCardInfo[];

  const aliveCard = aliveCardRaw
    ? {
        id: aliveCardRaw.id,
        carId: aliveCardRaw.car_id ?? "",
        cardTitle: aliveCardRaw.card_title ?? null,
        nickname: aliveCardRaw.nickname,
        pixelCardUrl: aliveCardRaw.pixel_card_url,
        personality: aliveCardRaw.personality ?? null,
        flavorText: aliveCardRaw.flavor_text ?? null,
        mintedAt: aliveCardRaw.minted_at,
        carLabel: `${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`,
        // Full card data so the mint page can render the actual trading card
        fullCard: aliveCardRaw as unknown as MintedCard,
      }
    : null;

  const mintableCars: MintableCar[] = [
    {
      id: primaryCar.id,
      year: primaryCar.year,
      make: primaryCar.make,
      model: primaryCar.model,
      trim: primaryCar.trim,
      color: primaryCar.color,
      nickname: primaryCar.nickname,
      cover_image_url: primaryCar.cover_image_url,
      is_primary: primaryCar.is_primary,
      cardCount: allCards.length,
      latestCard: allCards.at(-1) ?? null,
    },
  ];

  return (
    <MintPageClient
      cars={mintableCars}
      aliveCard={aliveCard}
      karma={0}
      karmaThreshold={0}
      ghostCards={ghostCards}
    />
  );
}
