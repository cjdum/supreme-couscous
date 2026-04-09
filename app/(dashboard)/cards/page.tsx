import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CardHub } from "@/components/cards/card-hub";
import type { MintedCard } from "@/lib/pixel-card";

export const metadata = { title: "Ghost Cards — MODVAULT" };

type FullCard = MintedCard & {
  personality?: string | null;
  card_level?: number | null;
  card_title?: string | null;
  status?: string | null;
  burned_at?: string | null;
  last_words?: string | null;
};

export default async function CardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch ALL cards newest first — we'll sort into live/ghost/all below
  const { data: allCardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("minted_at", { ascending: false });

  const allCards = (allCardsRaw ?? []) as FullCard[];

  // Detect whether the status column has been populated for this user's cards.
  // Pre-migration cards have status=null so we fall back gracefully.
  const hasStatusData = allCards.some(c => c.status === "alive" || c.status === "ghost");

  let liveCard: FullCard | null;
  let ghosts: FullCard[];

  if (hasStatusData) {
    liveCard = allCards.find(c => c.status === "alive") ?? null;
    ghosts = allCards.filter(c => c.status === "ghost")
      .sort((a, b) => {
        const da = a.burned_at ? new Date(a.burned_at).getTime() : 0;
        const db = b.burned_at ? new Date(b.burned_at).getTime() : 0;
        return db - da;
      });
  } else {
    // Pre-migration: treat most recent as the living card, rest are historical
    liveCard = allCards[0] ?? null;
    ghosts = allCards.slice(1);
  }

  // Car labels
  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, year, make, model")
    .eq("user_id", user.id);

  const carLabels: Record<string, string> = {};
  for (const c of (carsRaw ?? []) as { id: string; year: number; make: string; model: string }[]) {
    carLabels[c.id] = `${c.year} ${c.make} ${c.model}`;
  }

  return (
    <div className="min-h-dvh animate-fade">
      <CardHub
        liveCard={liveCard}
        ghosts={ghosts}
        allCards={allCards}
        carLabels={carLabels}
      />
    </div>
  );
}
