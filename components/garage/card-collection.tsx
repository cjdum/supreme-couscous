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

  // Group cards by car_id, maintain a stable car order (first appearance, sorted by oldest mint)
  const { groups, carOrder } = useMemo(() => {
    const map = new Map<string, MintedCard[]>();
    // Collect into groups (cards already sorted desc by minted_at from the server)
    for (const c of cards) {
      const key = c.car_id ?? `orphan:${c.id}`;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    // Within each group, sort oldest → newest for edition numbering, keep display newest→oldest
    const carOrder: string[] = [];
    for (const key of map.keys()) {
      carOrder.push(key);
    }
    // Each group: sort oldest first for edition numbers
    const editionMap = new Map<string, MintedCard[]>();
    for (const [key, arr] of map.entries()) {
      const sorted = [...arr].sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
      editionMap.set(key, sorted);
    }
    return { groups: map, carOrder, editionMap };
  }, [cards]);

  // Edition lookup: card.id → edition number within its car group
  const editionOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const arr of groups.values()) {
      // arr is desc (newest first) — sort oldest first for edition numbering
      const sorted = [...arr].sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
      sorted.forEach((c, i) => m.set(c.id, i + 1));
    }
    return m;
  }, [groups]);

  if (cards.length === 0) return null;

  function openViewer(card: MintedCard) {
    const key = card.car_id ?? `orphan:${card.id}`;
    const group = groups.get(key) ?? [card];
    // Sort oldest → newest so edition numbers match array index + 1
    const sorted = [...group].sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
    const startIndex = sorted.findIndex((c) => c.id === card.id);
    const label = card.car_id ? carLabels[card.car_id] : null;
    const snap = card.car_snapshot;
    const fallback = `${snap.year} ${snap.make} ${snap.model}`;
    setView({
      cards: sorted,
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
        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={15} className="text-[#f5d76e]" />
          <div>
            <h2 className="text-base font-bold tracking-tight">Collection</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {cards.length} permanent {cards.length === 1 ? "card" : "cards"} minted
            </p>
          </div>
        </div>

        {/* ── Cards grouped by car, each with a section header ─────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {carOrder.map((key) => {
            const group = groups.get(key)!;
            // Display newest → oldest
            const displayGroup = [...group].sort((a, b) => new Date(b.minted_at).getTime() - new Date(a.minted_at).getTime());
            const sample = displayGroup[0];
            const snap = sample.car_snapshot;
            const carLabel = (sample.car_id && carLabels[sample.car_id]) || `${snap.year} ${snap.make} ${snap.model}`;
            const totalEditions = group.length;

            return (
              <div key={key}>
                {/* Car section header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid rgba(123,79,212,0.18)",
                }}>
                  <div>
                    <h3 style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 900, color: "rgba(200,180,240,0.85)", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
                      {carLabel}
                    </h3>
                    <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: "rgba(160,140,200,0.4)", letterSpacing: "0.08em", margin: "2px 0 0" }}>
                      {totalEditions} {totalEditions === 1 ? "card" : "cards"}
                    </p>
                  </div>
                </div>

                {/* Cards grid for this car */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "1.5rem",
                  }}
                >
                  {displayGroup.map((card) => {
                    const cardSnap = card.car_snapshot;
                    const edition = editionOf.get(card.id) ?? 1;
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
                          buildScore={cardSnap.build_score}
                          vinVerified={cardSnap.vin_verified}
                          cardNumber={card.card_number}
                          era={card.era}
                          flavorText={card.flavor_text}
                          occasion={card.occasion}
                          mods={cardSnap.mods ?? []}
                          edition={totalEditions > 1 ? edition : null}
                          carLabel={carLabel}
                          scale={0.6}
                          idle
                          interactive={false}
                        />

                        {/* Era badge + card# */}
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

                        {/* Edition + mint date + occasion */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                          {totalEditions > 1 && (
                            <p style={{
                              margin: 0,
                              fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800,
                              color: "rgba(245,215,110,0.75)", letterSpacing: "0.15em", textTransform: "uppercase" as const,
                            }}>
                              Ed. {edition} / {totalEditions}
                            </p>
                          )}
                          <p style={{
                            margin: 0,
                            fontFamily: "ui-monospace, monospace", fontSize: 8,
                            color: "rgba(180,160,220,0.45)", letterSpacing: "0.08em",
                          }}>
                            {mintedDate}
                          </p>
                          {card.occasion && (
                            <p style={{
                              margin: "2px 0 0",
                              fontFamily: "ui-monospace, monospace", fontSize: 8, fontStyle: "italic",
                              color: eraStyle.text, letterSpacing: "0.04em",
                              maxWidth: 160, textAlign: "center",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              &ldquo;{card.occasion}&rdquo;
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
