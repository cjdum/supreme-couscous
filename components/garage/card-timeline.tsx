"use client";

import { useState } from "react";
import { GalleryHorizontal } from "lucide-react";
import { TradingCard } from "./trading-card";
import { CardViewerModal } from "./card-viewer-modal";
import { ERA_COLORS, safeEra } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

interface CardTimelineProps {
  /** All cards for a single car, sorted oldest → newest */
  cards: MintedCard[];
  carLabel: string;
}

export function CardTimeline({ cards, carLabel }: CardTimelineProps) {
  const [viewIdx, setViewIdx] = useState<number | null>(null);

  if (cards.length === 0) return null;

  return (
    <>
      {viewIdx !== null && (
        <CardViewerModal
          cards={cards}
          carLabel={carLabel}
          startIndex={viewIdx}
          onClose={() => setViewIdx(null)}
        />
      )}

      <div
        className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 lg:p-6"
        style={{ overflow: "hidden" }}
      >
        {/* Section header */}
        <div className="flex items-center gap-2 mb-4">
          <GalleryHorizontal size={14} style={{ color: "#7b4fd4", flexShrink: 0 }} />
          <div>
            <h2 className="text-base font-bold tracking-tight">Card Timeline</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {cards.length} {cards.length === 1 ? "snapshot" : "snapshots"} — tap to view
            </p>
          </div>
        </div>

        {/* Horizontal scroll strip */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            overflowX: "auto",
            paddingBottom: "0.5rem",
            // Smooth scrolling with momentum on iOS
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {cards.map((card, i) => {
            const era = safeEra(card.era);
            const eraStyle = ERA_COLORS[era];
            const edition = i + 1;
            const mintedDate = new Date(card.minted_at).toLocaleDateString(undefined, {
              month: "short", day: "numeric", year: "2-digit",
            });

            return (
              <button
                key={card.id}
                onClick={() => setViewIdx(i)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                {/* Card thumbnail */}
                <TradingCard
                  cardUrl={card.pixel_card_url}
                  nickname={card.nickname}
                  generatedAt={card.minted_at}
                  hp={card.hp}
                  modCount={card.mod_count}
                  buildScore={card.car_snapshot.build_score}
                  vinVerified={card.car_snapshot.vin_verified}
                  cardNumber={card.card_number}
                  era={card.era}
                  flavorText={card.flavor_text}
                  occasion={card.occasion}
                  mods={card.car_snapshot.mods ?? []}
                  edition={cards.length > 1 ? edition : null}
                  carLabel={carLabel}
                  scale={0.52}
                  idle={false}
                  interactive={false}
                />

                {/* Edition + date */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "1px 6px", borderRadius: 10,
                    background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                  }}>
                    <div style={{ width: 3, height: 3, borderRadius: "50%", background: eraStyle.text }} />
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: eraStyle.text }}>
                      {era}
                    </span>
                  </div>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: "rgba(245,215,110,0.7)", letterSpacing: "0.1em" }}>
                    Ed. {edition}
                  </span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 7, color: "rgba(160,140,200,0.45)", letterSpacing: "0.04em" }}>
                    {mintedDate}
                  </span>
                  {card.occasion && (
                    <span style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 7, fontStyle: "italic",
                      color: eraStyle.text, letterSpacing: "0.03em",
                      maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      &ldquo;{card.occasion}&rdquo;
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
