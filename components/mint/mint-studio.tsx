"use client";

import { useState } from "react";
import { PixelCard } from "@/components/garage/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MintableCar {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  color: string | null;
  nickname: string | null;
  cover_image_url: string | null;
  is_primary: boolean;
  cardCount: number;
  latestCard: MintedCard | null;
}

interface MintStudioProps {
  cars: MintableCar[];
}

type Phase = "select" | "mint";

// ── Car SVG silhouette (inline, no external dependency) ───────────────────────

function CarSilhouette() {
  return (
    <svg
      viewBox="0 0 64 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: 40, height: 20, opacity: 0.25 }}
      aria-hidden="true"
    >
      <path
        d="M6 22 C6 22 8 16 12 14 L20 10 C22 9 26 8 32 8 C38 8 42 9 44 10 L52 14 C56 16 58 22 58 22 L60 22 C61 22 62 23 62 24 L62 26 C62 27 61 28 60 28 L56 28 C56 28 55 30 52 30 C49 30 48 28 48 28 L16 28 C16 28 15 30 12 30 C9 30 8 28 8 28 L4 28 C3 28 2 27 2 26 L2 24 C2 23 3 22 4 22 Z"
        fill="currentColor"
      />
      <circle cx="12" cy="28" r="4" fill="rgba(6,6,17,1)" />
      <circle cx="52" cy="28" r="4" fill="rgba(6,6,17,1)" />
    </svg>
  );
}

// ── CarCard ───────────────────────────────────────────────────────────────────

interface CarCardProps {
  car: MintableCar;
  onSelect: (car: MintableCar) => void;
}

function CarCard({ car, onSelect }: CarCardProps) {
  const displayName = car.nickname ?? `${car.year} ${car.make} ${car.model}`;
  const subLabel = car.nickname ? `${car.year} ${car.make} ${car.model}` : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(car)}
      aria-label={`Select ${displayName} for minting`}
      className="mint-car-card"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(168,85,247,0.2)",
        cursor: "pointer",
        textAlign: "left",
        padding: 0,
        transition: "border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease",
      }}
    >
      {/* Cover image / placeholder */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#0d0d1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          color: "#a855f7",
        }}
      >
        {car.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={car.cover_image_url}
            alt={displayName}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              color: "rgba(168,85,247,0.3)",
            }}
          >
            <CarSilhouette />
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(6,6,17,0.95) 0%, rgba(6,6,17,0.4) 50%, transparent 100%)",
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />

        {/* Name overlay on photo */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px 14px 10px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 800,
              color: "#f0eeff",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}
          >
            {displayName}
          </p>
          {subLabel && (
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                color: "rgba(200,190,255,0.6)",
                fontWeight: 500,
                letterSpacing: "0.01em",
              }}
            >
              {subLabel}
            </p>
          )}
        </div>

        {/* Primary badge */}
        {car.is_primary && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#f5d76e",
              background: "rgba(245,215,110,0.14)",
              border: "1px solid rgba(245,215,110,0.35)",
              backdropFilter: "blur(4px)",
            }}
          >
            Primary
          </div>
        )}
      </div>

      {/* Card count badge row */}
      <div
        style={{
          padding: "10px 14px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: car.cardCount > 0 ? "rgba(168,85,247,0.75)" : "rgba(255,255,255,0.25)",
          }}
        >
          {car.cardCount === 0
            ? "No cards yet"
            : `${car.cardCount} card${car.cardCount !== 1 ? "s" : ""}`}
        </span>

        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(168,85,247,0.5)",
          }}
        >
          Mint &rarr;
        </span>
      </div>
    </button>
  );
}

// ── MintStudio ────────────────────────────────────────────────────────────────

export function MintStudio({ cars }: MintStudioProps) {
  const [phase, setPhase] = useState<Phase>("select");
  const [selected, setSelected] = useState<MintableCar | null>(null);

  function handleSelect(car: MintableCar) {
    setSelected(car);
    setPhase("mint");
  }

  function handleBack() {
    setPhase("select");
    setSelected(null);
  }

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: "#060611",
        overflowX: "hidden",
      }}
    >
      {/* ── Ambient glow elements ── */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {/* Top center radial */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            height: "60%",
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(123,79,212,0.15) 0%, transparent 60%)",
          }}
        />
        {/* Bottom-left accent */}
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "-10%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)",
          }}
        />
        {/* Top-right accent */}
        <div
          style={{
            position: "absolute",
            top: "5%",
            right: "-8%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(123,79,212,0.07) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Content layer ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {phase === "select" ? (
          <SelectPhase cars={cars} onSelect={handleSelect} />
        ) : selected ? (
          <MintPhase car={selected} onBack={handleBack} />
        ) : null}
      </div>

      {/* Hover styles injected once via a style tag */}
      <style>{`
        .mint-car-card:hover {
          border-color: rgba(168,85,247,0.6) !important;
          transform: scale(1.02);
          box-shadow: 0 0 0 1px rgba(168,85,247,0.15), 0 8px 32px rgba(123,79,212,0.18);
        }
        .mint-car-card:focus-visible {
          outline: 2px solid rgba(168,85,247,0.7);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .mint-car-card {
            transition: border-color 0ms !important;
            transform: none !important;
          }
          .mint-car-card:hover {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── SelectPhase ───────────────────────────────────────────────────────────────

interface SelectPhaseProps {
  cars: MintableCar[];
  onSelect: (car: MintableCar) => void;
}

function SelectPhase({ cars, onSelect }: SelectPhaseProps) {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "64px 20px 80px",
      }}
    >
      {/* Heading block */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 52,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(28px, 6vw, 48px)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#f0eeff",
            lineHeight: 1.1,
          }}
        >
          Choose Your Build
        </h1>
        <p
          style={{
            margin: "14px auto 0",
            fontSize: 14,
            color: "rgba(200,190,255,0.4)",
            letterSpacing: "0.06em",
            fontFamily: "ui-monospace, monospace",
            fontWeight: 500,
            maxWidth: 340,
          }}
        >
          Every mint is permanent. Choose wisely.
        </p>
      </div>

      {/* Responsive car grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
          gap: 16,
        }}
      >
        {cars.map((car) => (
          <CarCard key={car.id} car={car} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

// ── MintPhase ─────────────────────────────────────────────────────────────────

interface MintPhaseProps {
  car: MintableCar;
  onBack: () => void;
}

function MintPhase({ car, onBack }: MintPhaseProps) {
  const displayName = car.nickname ?? `${car.year} ${car.make} ${car.model}`;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "40px 20px 80px",
      }}
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to car selection"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 32,
          padding: "8px 14px",
          borderRadius: 10,
          background: "rgba(168,85,247,0.08)",
          border: "1px solid rgba(168,85,247,0.18)",
          color: "rgba(200,180,255,0.75)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
          letterSpacing: "0.01em",
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget;
          btn.style.background = "rgba(168,85,247,0.14)";
          btn.style.borderColor = "rgba(168,85,247,0.35)";
          btn.style.color = "rgba(220,200,255,0.95)";
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget;
          btn.style.background = "rgba(168,85,247,0.08)";
          btn.style.borderColor = "rgba(168,85,247,0.18)";
          btn.style.color = "rgba(200,180,255,0.75)";
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8.5 2.5L4 7L8.5 11.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back
      </button>

      {/* Car name heading */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(20px, 4vw, 32px)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "#f0eeff",
            lineHeight: 1.15,
          }}
        >
          {displayName}
        </h2>
        {car.nickname && (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: "rgba(200,190,255,0.45)",
              fontWeight: 500,
              letterSpacing: "0.01em",
            }}
          >
            {car.year} {car.make} {car.model}
          </p>
        )}
      </div>

      {/* PixelCard — centered */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <PixelCard
          carId={car.id}
          carLabel={`${car.year} ${car.make} ${car.model}`}
          latestCard={car.latestCard}
          cardCount={car.cardCount}
          trim={car.trim}
          color={car.color}
          autoMint={true}
        />
      </div>
    </div>
  );
}
