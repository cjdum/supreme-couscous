"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { TradingCard } from "./trading-card";
import { CardViewerModal } from "./card-viewer-modal";
import { calculateRarityFromScore, type PixelCardRarity } from "@/lib/pixel-card";
import type { Car } from "@/lib/supabase/types";

interface CardCollectionProps {
  cars: Car[];
}

export function CardCollection({ cars }: CardCollectionProps) {
  const [viewing, setViewing] = useState<Car | null>(null);

  const mintedCars = cars.filter((c) => c.pixel_card_url && c.pixel_card_nickname);

  if (mintedCars.length === 0) return null;

  return (
    <>
      {viewing && (
        <CardViewerModal car={viewing} onClose={() => setViewing(null)} />
      )}

      <section className="mt-14">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={15} className="text-[#f5d76e]" />
          <div>
            <h2 className="text-base font-bold tracking-tight">Card Collection</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {mintedCars.length} permanent {mintedCars.length === 1 ? "card" : "cards"} minted
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "2rem",
            padding: "0.5rem 0",
          }}
        >
          {mintedCars.map((car) => {
            const rarity: PixelCardRarity =
              (car.pixel_card_rarity as PixelCardRarity) ??
              calculateRarityFromScore(car.pixel_card_build_score ?? 0);

            return (
              <div
                key={car.id}
                onClick={() => setViewing(car)}
                style={{ cursor: "pointer", display: "flex", justifyContent: "center" }}
              >
                {/* Scale card from 280px → fit grid cell */}
                <div style={{ transform: "scale(0.72)", transformOrigin: "top center", height: 302 }}>
                  <TradingCard
                    cardUrl={car.pixel_card_url!}
                    nickname={car.pixel_card_nickname!}
                    generatedAt={car.pixel_card_generated_at}
                    hp={car.pixel_card_hp}
                    modCount={car.pixel_card_mod_count}
                    buildScore={car.pixel_card_build_score}
                    rarity={rarity}
                    vinVerified={car.vin_verified}
                    carLabel={`${car.year} ${car.make} ${car.model}`}
                    idle
                    interactive={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
