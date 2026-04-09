"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe, Lock, Wrench, Star, ShieldCheck } from "lucide-react";
import type { Car } from "@/lib/supabase/types";
import type { MintedCard } from "@/lib/pixel-card";
import { cn } from "@/lib/utils";
import { SetPrimaryButton } from "./set-primary-button";
import { CardViewerModal } from "./card-viewer-modal";

interface CarCardProps {
  car: Car;
  modCount?: number;
  isPrimary?: boolean;
  compact?: boolean;
  /** All minted cards for this car, newest → oldest (optional — for thumbnail + viewer) */
  cards?: MintedCard[];
}

const MAKE_COLORS: Record<string, string> = {
  porsche: "#a8252b",
  bmw: "#1c69d3",
  mercedes: "#00adef",
  ferrari: "#cc0000",
  lamborghini: "#f5a623",
  audi: "#888888",
  toyota: "#eb0a1e",
  honda: "#cc0000",
  subaru: "#003399",
  nissan: "#444444",
  ford: "#003476",
  chevrolet: "#d4a017",
};

function getMakeColor(make: string): string {
  return MAKE_COLORS[make.toLowerCase()] ?? "#3b82f6";
}

export function CarCard({
  car,
  modCount = 0,
  isPrimary = false,
  compact = false,
  cards = [],
}: CarCardProps) {
  const accent = getMakeColor(car.make);
  const [viewingCard, setViewingCard] = useState(false);

  const hasPixelCard = cards.length > 0;
  const latestCard = cards[0] ?? null; // cards arrive newest-first
  const carLabel = `${car.year} ${car.make} ${car.model}`;

  // Viewer needs oldest→newest
  const viewerCards = [...cards].reverse();

  return (
    <div className="relative">
      {viewingCard && hasPixelCard && (
        <CardViewerModal
          cards={viewerCards}
          carLabel={carLabel}
          startIndex={viewerCards.length - 1}
          onClose={() => setViewingCard(false)}
        />
      )}

      {/* Car card link */}
      <Link
        href={`/garage/${car.id}`}
        className={cn(
          "block relative rounded-2xl overflow-hidden group card-hover",
          isPrimary ? "primary-glow" : "border border-[var(--color-border)]"
        )}
        style={{ aspectRatio: compact ? "3/4" : "4/3" }}
      >
        {/* Background: photo or brand-tinted gradient */}
        {car.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={car.cover_image_url}
            alt={carLabel}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 25% 40%, ${accent}33 0%, transparent 65%),
                           linear-gradient(160deg, ${accent}1a 0%, #09090b 60%)`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                viewBox="0 0 120 54"
                width={compact ? "80" : "120"}
                height={compact ? "36" : "54"}
                fill="none"
                aria-hidden="true"
                style={{ opacity: 0.06 }}
              >
                <path
                  d="M12 42l9-24h78l9 24H12z"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 26l6-12h66l6 12H21z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  fill="white"
                  fillOpacity="0.04"
                />
                <ellipse cx="30" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
                <ellipse cx="90" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
              </svg>
            </div>
          </div>
        )}

        {/* Bottom-heavy gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/5" />

        {/* Top-left: primary badge or privacy badge */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {isPrimary ? (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
              style={{
                backgroundColor: "rgba(251,191,36,0.12)",
                backdropFilter: "blur(8px)",
                color: "#fbbf24",
                border: "1px solid rgba(251,191,36,0.20)",
              }}
            >
              <Star size={9} fill="currentColor" /> Primary
            </div>
          ) : (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium"
              style={{
                backgroundColor: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(8px)",
                color: car.is_public ? "#30d158" : "#555",
              }}
            >
              {car.is_public ? (
                <>
                  <Globe size={9} /> Public
                </>
              ) : (
                <>
                  <Lock size={9} /> Private
                </>
              )}
            </div>
          )}
        </div>

        {/* Top-right: VIN verified badge + set primary button */}
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
          {car.vin_verified && (
            <div
              title="VIN Verified via NHTSA"
              className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{
                backgroundColor: "rgba(245,215,110,0.10)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(245,215,110,0.30)",
              }}
            >
              <ShieldCheck size={9} style={{ color: "#f5d76e" }} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 900, letterSpacing: "0.15em", color: "#f5d76e" }}>
                VIN
              </span>
            </div>
          )}
          {!isPrimary && (
            <SetPrimaryButton carId={car.id} variant="prominent" />
          )}
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          {car.nickname && (
            <p
              className="text-[10px] font-semibold mb-0.5 truncate"
              style={{ color: accent === "#3b82f6" ? "#60a5fa" : accent }}
            >
              {car.nickname}
            </p>
          )}
          <h3
            className={`font-bold text-white truncate leading-snug ${
              compact ? "text-xs" : "text-sm"
            }`}
          >
            {car.year} {car.make} {car.model}
          </h3>
          {car.trim && !compact && (
            <p className="text-[11px] text-white/35 truncate mt-0.5">{car.trim}</p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {modCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-white/50">
                <Wrench size={9} />
                {modCount} mod{modCount !== 1 ? "s" : ""}
              </span>
            )}
            {car.vin_verified && (
              <span className="flex items-center gap-1 text-[10px] text-[#f5d76e]/60">
                <ShieldCheck size={9} />
                VIN
              </span>
            )}
            {!car.is_public && (
              <span className="flex items-center gap-1 text-[10px] text-white/30">
                <Lock size={9} />
                Private
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* ── Pixel card thumbnail — sits outside Link to avoid nested-interactive issue ── */}
      <button
        onClick={() => {
          if (hasPixelCard) {
            setViewingCard(true);
          } else {
            window.location.href = `/garage/${car.id}`;
          }
        }}
        title={hasPixelCard ? "View pixel card" : "Mint pixel card"}
        aria-label={hasPixelCard ? "View pixel card" : "Mint pixel card"}
        style={{
          position: "absolute",
          bottom: compact ? 10 : 14,
          right: compact ? 10 : 14,
          zIndex: 20,
          width: compact ? 28 : 34,
          height: compact ? 42 : 51,
          borderRadius: 4,
          background: hasPixelCard ? "#0d0d1a" : "rgba(0,0,0,0.55)",
          border: `1.5px solid ${hasPixelCard ? "#7b4fd4" : "rgba(255,255,255,0.12)"}`,
          transform: "rotate(-5deg)",
          boxShadow: hasPixelCard
            ? "0 2px 12px rgba(123,79,212,0.30), 0 4px 10px rgba(0,0,0,0.55)"
            : "0 2px 8px rgba(0,0,0,0.4)",
          overflow: "hidden",
          cursor: "pointer",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          padding: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform =
            "rotate(-2deg) scale(1.12)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = hasPixelCard
            ? "0 4px 20px rgba(123,79,212,0.45), 0 6px 14px rgba(0,0,0,0.6)"
            : "0 4px 12px rgba(0,0,0,0.5)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "rotate(-5deg)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = hasPixelCard
            ? "0 2px 12px rgba(123,79,212,0.30), 0 4px 10px rgba(0,0,0,0.55)"
            : "0 2px 8px rgba(0,0,0,0.4)";
        }}
      >
        {hasPixelCard && latestCard ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={latestCard.pixel_card_url}
            alt="Pixel card"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              imageRendering: "pixelated",
              background: "#0a0a18",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: compact ? 12 : 14, opacity: 0.3 }}>?</span>
          </div>
        )}
      </button>
    </div>
  );
}
