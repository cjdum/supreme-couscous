import Link from "next/link";
import { Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/page-container";
import { TradingCard } from "@/components/garage/trading-card";
import { ERA_COLORS, RARITY_COLORS, safeEra, safeRarity } from "@/lib/pixel-card";

export const metadata = { title: "Community Feed — MODVAULT" };

export default async function FeedPage() {
  const supabase = await createClient();

  // Fetch recent public cards — no auth required for RLS select on is_public=true
  const { data: cardsRaw } = await supabase
    .from("pixel_cards")
    .select("id, user_id, pixel_card_url, nickname, car_snapshot, era, rarity, card_number, occasion, minted_at, hp, mod_count, flavor_text")
    .eq("is_public", true)
    .order("minted_at", { ascending: false })
    .limit(60);

  type FeedCard = {
    id: string;
    user_id: string;
    pixel_card_url: string;
    nickname: string;
    car_snapshot: { year: number; make: string; model: string; total_invested: number | null; build_score: number | null; vin_verified: boolean; torque: number | null; zero_to_sixty: number | null; mods: string[]; mods_detail?: { name: string; cost: number | null; category: string }[] };
    era: string | null;
    rarity: string | null;
    card_number: number | null;
    occasion: string | null;
    minted_at: string;
    hp: number | null;
    mod_count: number | null;
    flavor_text: string | null;
  };

  const cards = (cardsRaw ?? []) as FeedCard[];

  // Fetch usernames for each unique user_id
  const uniqueUserIds = [...new Set(cards.map((c) => c.user_id))];
  let usernameMap: Record<string, string> = {};
  if (uniqueUserIds.length > 0) {
    const { data: profilesRaw } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", uniqueUserIds);
    for (const p of (profilesRaw ?? []) as { user_id: string; username: string }[]) {
      usernameMap[p.user_id] = p.username;
    }
  }

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="7xl" className="pt-10 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-[rgba(123,79,212,0.15)] border border-[rgba(123,79,212,0.3)]">
            <Globe size={18} style={{ color: "#7b4fd4" }} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">Community Feed</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {cards.length > 0
                ? `${cards.length} recently minted cards from the MODVAULT community`
                : "No public cards yet — mint yours and share it!"}
            </p>
          </div>
        </div>

        {cards.length === 0 ? (
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "80px 24px", gap: 16, textAlign: "center",
            }}
          >
            <Globe size={32} style={{ color: "rgba(123,79,212,0.35)" }} />
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "rgba(200,180,240,0.45)", letterSpacing: "0.06em" }}>
              The community feed is empty.
            </p>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(160,140,200,0.3)", maxWidth: 280 }}>
              Mint a card and set it to public to be the first one here.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "2rem 1.5rem",
              alignItems: "start",
            }}
          >
            {cards.map((card) => {
              const snap = card.car_snapshot;
              const carLabel = `${snap.year} ${snap.make} ${snap.model}`;
              const era = safeEra(card.era);
              const eraStyle = ERA_COLORS[era];
              const rarity = safeRarity(card.rarity);
              const rarityStyle = RARITY_COLORS[rarity];
              const username = usernameMap[card.user_id];
              const mintDate = new Date(card.minted_at).toLocaleDateString(undefined, {
                month: "short", day: "numeric", year: "numeric",
              });

              return (
                <Link
                  key={card.id}
                  href={`/c/${card.id}`}
                  style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                >
                  <TradingCard
                    cardUrl={card.pixel_card_url}
                    nickname={card.nickname}
                    generatedAt={card.minted_at}
                    hp={card.hp}
                    modCount={card.mod_count}
                    buildScore={snap.build_score}
                    vinVerified={snap.vin_verified}
                    cardNumber={card.card_number}
                    era={card.era}
                    rarity={card.rarity}
                    flavorText={card.flavor_text}
                    occasion={card.occasion}
                    mods={snap.mods ?? []}
                    modsDetail={snap.mods_detail}
                    torque={snap.torque ?? null}
                    zeroToSixty={snap.zero_to_sixty ?? null}
                    totalInvested={snap.total_invested ?? null}
                    carLabel={carLabel}
                    scale={0.65}
                    idle
                    interactive={false}
                  />

                  {/* Era + rarity */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "2px 7px", borderRadius: 12,
                      background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                    }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: eraStyle.text }} />
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: eraStyle.text }}>
                        {era}
                      </span>
                    </div>
                    <div style={{
                      padding: "2px 6px", borderRadius: 12,
                      background: rarityStyle.bg, border: `1px solid ${rarityStyle.border}`,
                      boxShadow: rarity === "Legendary" ? `0 0 8px ${rarityStyle.glow}` : "none",
                    }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: rarityStyle.text }}>
                        {rarity}
                      </span>
                    </div>
                  </div>

                  {/* Car name */}
                  <p style={{
                    fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700,
                    color: "var(--color-text-primary)", letterSpacing: "0.06em",
                    textAlign: "center", margin: 0,
                  }}>
                    {carLabel}
                  </p>

                  {/* Username + edition + date */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    {username && (
                      <p style={{
                        fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 600,
                        color: "rgba(168,85,247,0.7)", letterSpacing: "0.08em", margin: 0,
                      }}>
                        @{username}
                      </p>
                    )}
                    {card.card_number != null && (
                      <p style={{
                        fontFamily: "ui-monospace, monospace", fontSize: 8,
                        color: "rgba(200,180,240,0.4)", letterSpacing: "0.1em", margin: 0,
                      }}>
                        #{String(card.card_number).padStart(4, "0")}
                      </p>
                    )}
                    <p style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 8,
                      color: "rgba(160,140,200,0.35)", letterSpacing: "0.06em", margin: 0,
                    }}>
                      {mintDate}
                    </p>
                    {card.occasion && (
                      <p style={{
                        fontFamily: "ui-monospace, monospace", fontSize: 8, fontStyle: "italic",
                        color: eraStyle.text, letterSpacing: "0.04em",
                        maxWidth: 160, textAlign: "center", margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        &ldquo;{card.occasion}&rdquo;
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
