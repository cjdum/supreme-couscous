import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CardHub } from "@/components/cards/card-hub";
import type { MintedCard } from "@/lib/pixel-card";

export const metadata = { title: "Cards — MODVAULT" };

type FullCard = MintedCard & {
  personality?: string | null;
  card_level?: number | null;
  card_title?: string | null;
  status?: string;
  burned_at?: string | null;
  last_words?: string | null;
};

export default async function CardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Alive card (only one should exist)
  const { data: liveCardRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "alive")
    .maybeSingle();

  // Ghost cards — burned history, newest burn first
  const { data: ghostsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ghost")
    .order("burned_at", { ascending: false });

  // Fallback: if status column not yet migrated, show most recent as live and rest as ghosts
  let liveCard: FullCard | null = liveCardRaw as FullCard | null;
  let ghosts: FullCard[] = (ghostsRaw ?? []) as FullCard[];

  if (!liveCardRaw && !ghostsRaw) {
    // status column might not exist yet — fall back to all cards
    const { data: allRaw } = await supabase
      .from("pixel_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("minted_at", { ascending: false });
    const all = (allRaw ?? []) as FullCard[];
    liveCard = all[0] ?? null;
    ghosts = all.slice(1);
  }

  // Car labels for display
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
      <CardHub liveCard={liveCard} ghosts={ghosts} carLabels={carLabels} />
    </div>
  );
}
