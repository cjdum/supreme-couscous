"use client";

import { useState } from "react";
import { TradingCard } from "./trading-card";
import { CardViewerModal } from "./card-viewer-modal";
import type { MintedCard } from "@/lib/pixel-card";

interface Props {
  card: MintedCard;
  carLabel: string;
  scale?: number;
}

export function HeroCardViewer({ card, carLabel, scale = 1.0 }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "block" }}
        aria-label={`View ${card.nickname ?? carLabel} card`}
      >
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
          rarity={card.rarity}
          flavorText={card.flavor_text}
          occasion={card.occasion}
          mods={card.car_snapshot.mods ?? []}
          modsDetail={card.car_snapshot.mods_detail}
          torque={card.car_snapshot.torque ?? null}
          zeroToSixty={card.car_snapshot.zero_to_sixty ?? null}
          totalInvested={card.car_snapshot.total_invested ?? null}
          carLabel={carLabel}
          scale={scale}
          idle
          interactive
        />
      </button>

      {open && (
        <CardViewerModal
          cards={[card]}
          carLabel={carLabel}
          startIndex={0}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
