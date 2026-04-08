import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MintPageClient } from "@/components/mint/mint-page-client";
import type { MintableCar } from "@/components/mint/mint-studio";
import type { MintedCard } from "@/lib/pixel-card";
import { KARMA_BURN_THRESHOLD } from "@/lib/card-personality";

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

  // Fetch all pixel cards for this user, oldest-first
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

  // Find the alive card (status='alive', or fallback: most recent card if status column not yet migrated)
  type AnyCard = MintedCard & { status?: string; personality?: string | null; card_level?: number | null };
  const aliveCardRaw = (allCards as AnyCard[]).find((c) => c.status === "alive") ??
    (allCards as AnyCard[]).at(-1) ?? null; // fallback before migration

  let aliveCard = null;
  if (aliveCardRaw) {
    const snap = aliveCardRaw.car_snapshot;
    aliveCard = {
      id: aliveCardRaw.id,
      cardTitle: (aliveCardRaw as AnyCard & { card_title?: string | null }).card_title ?? null,
      nickname: aliveCardRaw.nickname,
      pixelCardUrl: aliveCardRaw.pixel_card_url,
      personality: (aliveCardRaw as AnyCard).personality ?? null,
      flavorText: aliveCardRaw.flavor_text ?? null,
      mintedAt: aliveCardRaw.minted_at,
      carLabel: `${snap.year} ${snap.make} ${snap.model}`,
    };
  }

  // Compute karma server-side (same logic as GET /api/cards/karma)
  const [battlesResult, postsResult, ratingsResult] = await Promise.all([
    supabase
      .from("card_battles")
      .select("outcome, challenger_user_id")
      .or(`challenger_user_id.eq.${user.id},opponent_user_id.eq.${user.id}`),
    supabase
      .from("forum_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("card_ratings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  type BattleRow = { outcome: string; challenger_user_id: string };
  const battles = (battlesResult.data ?? []) as BattleRow[];
  const battlesFought = battles.length;
  const battlesWon = battles.filter(
    (b) => b.challenger_user_id === user.id
      ? b.outcome === "win" || b.outcome === "narrow_win"
      : b.outcome === "loss" || b.outcome === "narrow_loss",
  ).length;
  const forumPosts = postsResult.count ?? 0;
  const ratingsGiven = ratingsResult.count ?? 0;
  const karma = battlesFought * 5 + battlesWon * 3 + forumPosts * 5 + ratingsGiven * 2;

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

  return (
    <MintPageClient
      cars={mintableCars}
      aliveCard={aliveCard}
      karma={karma}
      karmaThreshold={KARMA_BURN_THRESHOLD}
    />
  );
}
