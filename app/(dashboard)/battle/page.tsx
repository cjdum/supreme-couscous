import { createClient } from "@/lib/supabase/server";
import { BattleScreen } from "@/components/battle/battle-screen";
import { redirect } from "next/navigation";
import type { MintedCard } from "@/lib/pixel-card";

export const metadata = { title: "Battle — MODVAULT" };

export default async function BattlePage({
  searchParams,
}: {
  searchParams: Promise<{ opponent?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load primary car
  const { data: carsRaw } = await supabase
    .from("cars").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const cars = (carsRaw ?? []) as { id: string; is_primary: boolean; year: number; make: string; model: string }[];
  const primaryCar = cars.find(c => c.is_primary) ?? cars[0] ?? null;

  if (!primaryCar) redirect("/garage");

  // Load latest alive card
  const { data: cardsRaw } = await supabase
    .from("pixel_cards").select("*")
    .eq("user_id", user.id).eq("car_id", primaryCar.id)
    .eq("status" as never, "alive" as never)
    .order("minted_at", { ascending: false })
    .limit(1);
  const card = ((cardsRaw ?? [])[0] ?? null) as MintedCard | null;

  if (!card) redirect("/mint");

  const carLabel = `${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`;
  const battleRecord = (card as unknown as { battle_record?: { wins?: number; losses?: number } }).battle_record ?? null;

  // Load active battles for this user
  const { data: activeBattlesRaw } = await supabase
    .from("battle_challenges")
    .select("*")
    .or(`challenger_user_id.eq.${user.id},opponent_user_id.eq.${user.id}`)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })
    .limit(20);

  type BattleChallenge = {
    id: string;
    challenger_card_id: string;
    opponent_card_id: string;
    challenger_user_id: string;
    opponent_user_id: string;
    battle_prompt: string;
    challenger_argument: string;
    opponent_argument: string;
    status: string;
    winner_card_id: string | null;
    created_at: string;
    expires_at: string;
  };
  const activeBattles = (activeBattlesRaw ?? []) as BattleChallenge[];

  // Load past completed battles
  const { data: pastBattlesRaw } = await supabase
    .from("battle_challenges")
    .select("*")
    .or(`challenger_user_id.eq.${user.id},opponent_user_id.eq.${user.id}`)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(10);
  const pastBattles = (pastBattlesRaw ?? []) as BattleChallenge[];

  // If opponent query param, load opponent card
  let opponentCard: MintedCard | null = null;
  if (params.opponent) {
    const { data: oppRaw } = await supabase
      .from("pixel_cards")
      .select("*")
      .eq("id", params.opponent)
      .eq("status" as never, "alive" as never)
      .maybeSingle();
    opponentCard = oppRaw as MintedCard | null;
  }

  // Load community cards for opponent browser
  const { data: communityRaw } = await supabase
    .from("pixel_cards")
    .select("id, user_id, pixel_card_url, nickname, hp, flavor_text, minted_at, card_number, personality, battle_record, mod_count")
    .eq("status" as never, "alive" as never)
    .eq("is_public", true)
    .neq("user_id", user.id)
    .order("minted_at", { ascending: false })
    .limit(24);

  type CommunityCard = {
    id: string;
    user_id: string;
    pixel_card_url: string;
    nickname: string;
    hp: number | null;
    flavor_text: string | null;
    minted_at: string;
    card_number: number | null;
    personality: string | null;
    battle_record: { wins: number; losses: number } | null;
    mod_count: number | null;
    username?: string;
  };
  const communityCardsBase = (communityRaw ?? []) as CommunityCard[];

  // Get usernames
  const communityUserIds = [...new Set(communityCardsBase.map((c) => c.user_id))];
  const { data: communityProfilesRaw } = communityUserIds.length > 0
    ? await supabase.from("profiles").select("user_id, username").in("user_id", communityUserIds)
    : { data: [] };
  const communityUsernameMap: Record<string, string> = {};
  for (const p of (communityProfilesRaw ?? []) as { user_id: string; username: string }[]) {
    communityUsernameMap[p.user_id] = p.username;
  }
  const communityCards = communityCardsBase.map((c) => ({ ...c, username: communityUsernameMap[c.user_id] ?? "user" }));

  return (
    <div className="min-h-dvh animate-fade">
      <BattleScreen
        userCard={card}
        carLabel={carLabel}
        initialWins={battleRecord?.wins ?? 0}
        initialLosses={battleRecord?.losses ?? 0}
        activeBattles={activeBattles}
        pastBattles={pastBattles}
        preselectedOpponent={opponentCard}
        userId={user.id}
        communityCards={communityCards}
      />
    </div>
  );
}
