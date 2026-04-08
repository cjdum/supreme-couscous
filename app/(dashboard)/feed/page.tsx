"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Globe, Flame, Swords, Trophy } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { TradingCard } from "@/components/garage/trading-card";
import { ERA_COLORS, RARITY_COLORS, safeEra, safeRarity } from "@/lib/pixel-card";

interface FeedCard {
  id: string;
  user_id: string;
  pixel_card_url: string;
  card_title: string | null;
  nickname: string;
  car_snapshot: {
    year: number;
    make: string;
    model: string;
    total_invested: number | null;
    build_score: number | null;
    vin_verified: boolean;
    torque: number | null;
    zero_to_sixty: number | null;
    mods: string[];
    mods_detail?: { name: string; cost: number | null; category: string }[];
  };
  era: string | null;
  rarity: string | null;
  card_number: number | null;
  occasion: string | null;
  minted_at: string;
  hp: number | null;
  mod_count: number | null;
  flavor_text: string | null;
  build_archetype: string | null;
  authenticity_confidence: number | null;
  battle_record: { wins: number; losses: number };
  username: string | null;
  owner_builder_score: number;
}

type Tab = "for_you" | "new" | "top" | "battle_leaders";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }> }[] = [
  { id: "for_you", label: "For You", icon: Flame },
  { id: "new", label: "New Builds", icon: Globe },
  { id: "top", label: "Top Rated", icon: Trophy },
  { id: "battle_leaders", label: "Battle Leaders", icon: Swords },
];

export default function FeedPage() {
  const [tab, setTab] = useState<Tab>("for_you");
  const [archetype, setArchetype] = useState<string | null>(null);
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ tab });
        if (tab === "top" && archetype) params.set("archetype", archetype);
        const res = await fetch(`/api/feed?${params}`);
        const json = await res.json();
        setCards(json.cards ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, archetype]);

  const archetypes = useMemo(() => {
    const s = new Set<string>();
    for (const c of cards) if (c.build_archetype) s.add(c.build_archetype);
    return [...s];
  }, [cards]);

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="7xl" className="pt-10 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-[rgba(123,79,212,0.15)] border border-[rgba(123,79,212,0.3)]">
            <Globe size={18} style={{ color: "#7b4fd4" }} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">Feed</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Cards from the MODVAULT community
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-2xl max-w-xl" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 h-10 px-3 rounded-xl text-[11px] font-bold tracking-wide inline-flex items-center justify-center gap-1.5 transition-colors"
                style={{
                  background: active ? "var(--color-accent)" : "transparent",
                  color: active ? "#fff" : "var(--color-text-muted)",
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Archetype filter (Top Rated only) */}
        {tab === "top" && archetypes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => setArchetype(null)}
              className="px-3 h-8 rounded-full text-[10px] font-bold"
              style={{
                background: archetype == null ? "var(--color-accent)" : "var(--color-bg-card)",
                color: archetype == null ? "#fff" : "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
            >
              All
            </button>
            {archetypes.map((a) => (
              <button
                key={a}
                onClick={() => setArchetype(a)}
                className="px-3 h-8 rounded-full text-[10px] font-bold"
                style={{
                  background: archetype === a ? "var(--color-accent)" : "var(--color-bg-card)",
                  color: archetype === a ? "#fff" : "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-sm text-[var(--color-text-muted)]">Loading...</div>
        )}

        {!loading && cards.length === 0 && (
          <div className="text-center py-20">
            <Globe size={32} className="mx-auto mb-4 text-[var(--color-text-muted)] opacity-30" />
            <p className="text-sm text-[var(--color-text-secondary)]">No cards in this tab yet.</p>
          </div>
        )}

        {!loading && cards.length > 0 && (
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
              return (
                <Link
                  key={card.id}
                  href={`/c/${card.id}`}
                  style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                >
                  <TradingCard
                    cardUrl={card.pixel_card_url}
                    nickname={card.card_title ?? card.nickname}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "2px 7px", borderRadius: 12,
                        background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                      }}
                    >
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: eraStyle.text }} />
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: eraStyle.text }}>
                        {era}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "2px 6px", borderRadius: 12,
                        background: rarityStyle.bg, border: `1px solid ${rarityStyle.border}`,
                      }}
                    >
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: rarityStyle.text }}>
                        {rarity}
                      </span>
                    </div>
                  </div>
                  <p style={{
                    fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700,
                    color: "var(--color-text-primary)", letterSpacing: "0.06em",
                    textAlign: "center", margin: 0,
                  }}>
                    {carLabel}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    {card.username && (
                      <p style={{
                        fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 600,
                        color: "rgba(168,85,247,0.7)", letterSpacing: "0.08em", margin: 0,
                      }}>
                        @{card.username}
                        {card.owner_builder_score > 0 ? ` · BS ${card.owner_builder_score}` : ""}
                      </p>
                    )}
                    {(card.battle_record.wins > 0 || card.battle_record.losses > 0) && (
                      <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, color: "rgba(200,180,240,0.5)" }}>
                        {card.battle_record.wins}W · {card.battle_record.losses}L
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
