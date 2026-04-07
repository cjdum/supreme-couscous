"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { TradingCard } from "./trading-card";
import { CardViewerModal } from "./card-viewer-modal";
import { ERA_COLORS, safeEra } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

interface CardCollectionProps {
  /** All minted cards for the current user, sorted minted_at desc */
  cards: MintedCard[];
  /** Map of car_id → "YYYY Make Model" label (for cards whose car still exists) */
  carLabels: Record<string, string>;
}

interface ViewState {
  cards: MintedCard[];
  carLabel: string;
  startIndex: number;
}

export function CardCollection({ cards, carLabels }: CardCollectionProps) {
  const [view, setView] = useState<ViewState | null>(null);

  // Group cards by car_id so we can navigate editions in the viewer.
  const grouped = useMemo(() => {
    const map = new Map<string, MintedCard[]>();
    for (const c of cards) {
      const key = c.car_id ?? `orphan:${c.id}`;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    // Sort each group oldest → newest (Edition 1, 2, ...)
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
    }
    return map;
  }, [cards]);

  if (cards.length === 0) return null;

  function openViewer(card: MintedCard) {
    const key = card.car_id ?? `orphan:${card.id}`;
    const group = grouped.get(key) ?? [card];
    const startIndex = group.findIndex((c) => c.id === card.id);
    const label = card.car_id ? carLabels[card.car_id] : null;
    const snap = card.car_snapshot;
    const fallback = `${snap.year} ${snap.make} ${snap.model}`;
    setView({
      cards: group,
      carLabel: label ?? fallback,
      startIndex: Math.max(0, startIndex),
    });
  }

  return (
    <>
      {view && (
        <CardViewerModal
          cards={view.cards}
          carLabel={view.carLabel}
          startIndex={view.startIndex}
          onClose={() => setView(null)}
        />
      )}

      <section className="mt-14">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={15} className="text-[#f5d76e]" />
          <div>
            <h2 className="text-base font-bold tracking-tight">Collection &amp; Awards</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {cards.length} permanent {cards.length === 1 ? "card" : "cards"} minted
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "1.5rem",
            padding: "0.5rem 0",
          }}
        >
          {cards.map((card) => {
            const snap = card.car_snapshot;
            const label = (card.car_id && carLabels[card.car_id]) || `${snap.year} ${snap.make} ${snap.model}`;
            const group = grouped.get(card.car_id ?? `orphan:${card.id}`) ?? [card];
            const edition = group.findIndex((c) => c.id === card.id) + 1;

            const era = safeEra(card.era);
            const eraStyle = ERA_COLORS[era];
            const mintedDate = new Date(card.minted_at).toLocaleDateString(undefined, {
              month: "short", day: "numeric", year: "numeric",
            });

            return (
              <button
                key={card.id}
                onClick={() => openViewer(card)}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  gap: 6,
                }}
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
                  flavorText={card.flavor_text}
                  mods={snap.mods ?? []}
                  edition={group.length > 1 ? edition : null}
                  carLabel={label}
                  scale={0.6}
                  idle
                  interactive={false}
                />

                {/* Meta row: era badge + card# */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "2px 7px", borderRadius: 12,
                    background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                  }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: eraStyle.text, flexShrink: 0 }} />
                    <span style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 900,
                      letterSpacing: "0.18em", textTransform: "uppercase" as const, color: eraStyle.text,
                    }}>
                      {era}
                    </span>
                  </div>
                  {card.card_number != null && (
                    <span style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700,
                      color: "rgba(200,180,240,0.5)", letterSpacing: "0.1em",
                    }}>
                      #{String(card.card_number).padStart(4, "0")}
                    </span>
                  )}
                </div>

                {/* Edition + mint date */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  {group.length > 1 && (
                    <p style={{
                      margin: 0,
                      fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800,
                      color: "rgba(245,215,110,0.75)", letterSpacing: "0.15em", textTransform: "uppercase" as const,
                    }}>
                      Ed. {edition} / {group.length}
                    </p>
                  )}
                  <p style={{
                    margin: 0,
                    fontFamily: "ui-monospace, monospace", fontSize: 8,
                    color: "rgba(180,160,220,0.45)", letterSpacing: "0.08em",
                  }}>
                    {mintedDate}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
