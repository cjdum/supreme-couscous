"use client";

import { useState } from "react";
import { Flame, Ghost } from "lucide-react";
import { PixelCard } from "@/components/garage/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

// ── Types ──────────────────────────────────────────────────────────────────────

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

export type GhostCardInfo = MintedCard & {
  card_title?: string | null;
  status?: string | null;
  burned_at?: string | null;
  last_words?: string | null;
};

export interface AliveCardInfo {
  id: string;
  carId: string;
  cardTitle: string | null;
  nickname: string;
  pixelCardUrl: string;
  personality: string | null;
  flavorText: string | null;
  mintedAt: string;
  carLabel: string;
}

interface MintStudioProps {
  cars: MintableCar[];
  aliveCard: AliveCardInfo | null;
  /** When set (after a burn), skip car selection and go straight to this car */
  autoMintCarId?: string | null;
  onInitiateBurn: () => void;
  /** Skip the burn ceremony — quietly retire the card and go straight to minting */
  onSkipCeremony: () => void;
  /** Previously burned cards to show in the ghost archive */
  ghostCards?: GhostCardInfo[];
}

type Phase = "select" | "mint";
type BurnState = "idle" | "confirm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── CarSilhouette ─────────────────────────────────────────────────────────────

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

// ── AliveCardPreview ──────────────────────────────────────────────────────────

interface AliveCardPreviewProps {
  card: AliveCardInfo;
  compact?: boolean;
}

function AliveCardPreview({ card, compact = false }: AliveCardPreviewProps) {
  const title = card.cardTitle ?? card.nickname;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: compact ? 10 : 14,
      }}
    >
      {/* Card image */}
      <div
        style={{
          position: "relative",
          width: compact ? 140 : 180,
          height: compact ? 196 : 252,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 0 0 1px rgba(168,85,247,0.3), 0 8px 32px rgba(123,79,212,0.25)",
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.pixelCardUrl}
          alt={title}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Alive pulse dot */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#30d158",
            boxShadow: "0 0 0 3px rgba(48,209,88,0.25)",
            animation: "alivePulse 2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Title + personality */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
        <p
          style={{
            margin: 0,
            fontSize: compact ? 13 : 15,
            fontWeight: 700,
            color: "#f0eeff",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </p>
        {card.personality && (
          <span
            style={{
              display: "inline-block",
              alignSelf: "center",
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#c084fc",
              background: "rgba(168,85,247,0.14)",
              border: "1px solid rgba(168,85,247,0.3)",
            }}
          >
            {card.personality}
          </span>
        )}
        {!compact && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "rgba(200,190,255,0.4)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.04em",
            }}
          >
            Alive since {formatDate(card.mintedAt)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── AliveWithLock (State 2) ────────────────────────────────────────────────────

// ── AliveWithBurn ─────────────────────────────────────────────────────────────

interface AliveWithBurnProps {
  card: AliveCardInfo;
  burnState: BurnState;
  onBurnClick: () => void;
  onBurnCancel: () => void;
  onBurnConfirm: () => void;
  onSkipCeremony: () => void;
}

function AliveWithBurn({
  card,
  burnState,
  onBurnClick,
  onBurnCancel,
  onBurnConfirm,
  onSkipCeremony,
}: AliveWithBurnProps) {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "64px 20px 80px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
      }}
    >
      {/* Alive card with date */}
      <AliveCardPreview card={card} />

      {burnState === "idle" ? (
        /* ── Burn CTA ── */
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <button
            type="button"
            onClick={onBurnClick}
            className="burn-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 32px",
              borderRadius: 12,
              background: "rgba(220,38,38,0.12)",
              border: "1px solid rgba(220,38,38,0.4)",
              color: "#f87171",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.01em",
              cursor: "pointer",
              transition: "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
            }}
          >
            <Flame size={17} aria-hidden="true" />
            Burn this card
          </button>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "rgba(200,190,255,0.3)",
              textAlign: "center",
              letterSpacing: "0.01em",
              lineHeight: 1.5,
            }}
          >
            This is permanent. Your card&rsquo;s last words will be spoken.
          </p>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginTop: 4 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 10, color: "rgba(200,190,255,0.2)", letterSpacing: "0.08em", fontFamily: "ui-monospace, monospace" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Skip ceremony option */}
          <button
            type="button"
            onClick={onSkipCeremony}
            className="skip-ceremony-btn"
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(200,190,255,0.45)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            Skip the drama — just mint a new card
          </button>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              color: "rgba(200,190,255,0.2)",
              textAlign: "center",
              letterSpacing: "0.01em",
            }}
          >
            Quietly retires the current card. No ceremony.
          </p>
        </div>
      ) : (
        /* ── Burn confirmation panel ── */
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm card burn"
          style={{
            width: "100%",
            background: "rgba(40, 10, 10, 0.6)",
            border: "1px solid rgba(220,38,38,0.35)",
            borderRadius: 16,
            padding: "24px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: "#fca5a5",
                letterSpacing: "-0.01em",
              }}
            >
              Are you sure?
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "rgba(200,190,255,0.5)",
                lineHeight: 1.55,
              }}
            >
              Once burned, this card becomes a ghost. Its last words are eternal.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onBurnCancel}
              className="cancel-btn"
              style={{
                padding: "12px 0",
                borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(200,190,255,0.7)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onBurnConfirm}
              className="confirm-burn-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                padding: "12px 0",
                borderRadius: 10,
                background: "rgba(220,38,38,0.18)",
                border: "1px solid rgba(220,38,38,0.5)",
                color: "#f87171",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
            >
              <Flame size={14} aria-hidden="true" />
              Yes, burn it
            </button>
          </div>
        </div>
      )}
    </div>
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
        transition:
          "border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease",
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
            color:
              car.cardCount > 0
                ? "rgba(168,85,247,0.75)"
                : "rgba(255,255,255,0.25)",
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
      <div style={{ textAlign: "center", marginBottom: 52 }}>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
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
  hideBack?: boolean;
}

function MintPhase({ car, onBack, hideBack = false }: MintPhaseProps) {
  const displayName = car.nickname ?? `${car.year} ${car.make} ${car.model}`;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "40px 20px 80px",
      }}
    >
      {/* Back button — only shown when there are multiple cars to choose from */}
      {!hideBack && (
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
            transition:
              "background 150ms ease, border-color 150ms ease, color 150ms ease",
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
      )}

      {/* Car name */}
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

      {/* PixelCard centered */}
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

// ── GhostArchive ──────────────────────────────────────────────────────────────

function GhostArchive({ ghosts }: { ghosts: GhostCardInfo[] }) {
  if (ghosts.length === 0) return null;

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto 64px",
        padding: "0 20px",
      }}
    >
      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(180,40,40,0.18)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Ghost size={12} style={{ color: "rgba(180,100,100,0.55)" }} />
          <span style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase" as const,
            color: "rgba(180,100,100,0.55)",
          }}>
            Ghost Archive
          </span>
        </div>
        <div style={{ flex: 1, height: 1, background: "rgba(180,40,40,0.18)" }} />
      </div>

      {/* Ghost cards grid */}
      <div style={{
        display: "flex",
        gap: 14,
        overflowX: "auto",
        paddingBottom: 8,
        scrollbarWidth: "none" as const,
      }}>
        {ghosts.map((ghost) => {
          const snap = ghost.car_snapshot;
          const title = ghost.card_title ?? ghost.nickname;
          const burnedDate = ghost.burned_at
            ? new Date(ghost.burned_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
            : null;

          return (
            <div
              key={ghost.id}
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                width: 100,
              }}
            >
              {/* Card thumbnail — grayscale */}
              <div style={{ position: "relative" }}>
                <div style={{ filter: "grayscale(1) brightness(0.38) sepia(0.1)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ghost.pixel_card_url}
                    alt={title}
                    style={{
                      width: 70,
                      height: 98,
                      objectFit: "cover",
                      borderRadius: 8,
                      imageRendering: "pixelated",
                      border: "1px solid rgba(150,50,50,0.35)",
                    }}
                  />
                </div>
                {/* Ghost overlay */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.15)",
                  pointerEvents: "none",
                }}>
                  <span style={{
                    fontSize: 7,
                    fontWeight: 900,
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.2em",
                    color: "rgba(200,80,80,0.75)",
                    textTransform: "uppercase" as const,
                    textShadow: "0 0 8px rgba(200,60,60,0.4)",
                  }}>
                    GHOST
                  </span>
                </div>
              </div>

              {/* Card info */}
              <div style={{ textAlign: "center" as const, display: "flex", flexDirection: "column", gap: 3 }}>
                <p style={{
                  margin: 0,
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(180,160,200,0.6)",
                  letterSpacing: "0.02em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap" as const,
                  maxWidth: 96,
                }}>
                  {title}
                </p>
                {ghost.last_words && (
                  <p style={{
                    margin: 0,
                    fontSize: 8,
                    fontStyle: "italic",
                    color: "rgba(160,130,170,0.45)",
                    lineHeight: 1.45,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }}>
                    &ldquo;{ghost.last_words}&rdquo;
                  </p>
                )}
                {!ghost.last_words && snap && (
                  <p style={{
                    margin: 0,
                    fontSize: 8,
                    color: "rgba(160,130,170,0.35)",
                    fontFamily: "ui-monospace, monospace",
                  }}>
                    {snap.year} {snap.make}
                  </p>
                )}
                {burnedDate && (
                  <p style={{
                    margin: 0,
                    fontSize: 7,
                    fontFamily: "ui-monospace, monospace",
                    color: "rgba(160,100,100,0.45)",
                    letterSpacing: "0.06em",
                  }}>
                    {burnedDate}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MintStudio ────────────────────────────────────────────────────────────────

export function MintStudio({
  cars,
  aliveCard,
  autoMintCarId,
  onInitiateBurn,
  onSkipCeremony,
  ghostCards = [],
}: MintStudioProps) {
  // If autoMintCarId is provided (after burn), skip car selection
  const autoMintCar = autoMintCarId ? (cars.find(c => c.id === autoMintCarId) ?? null) : null;
  // If there's only one car and no alive card, skip SelectPhase entirely
  const onlyCarDefault = !aliveCard && cars.length === 1 ? cars[0] : null;
  const initialCar = autoMintCar ?? onlyCarDefault ?? null;

  const [phase, setPhase] = useState<Phase>(initialCar ? "mint" : "select");
  const [selected, setSelected] = useState<MintableCar | null>(initialCar);
  const [burnState, setBurnState] = useState<BurnState>("idle");

  function handleSelect(car: MintableCar) {
    setSelected(car);
    setPhase("mint");
  }

  function handleBack() {
    setPhase("select");
    setSelected(null);
  }

  // State 1: no alive card → show normal car picker / mint flow
  // State 2: alive card exists → show burn flow (no karma gate)
  const hasAlive = aliveCard !== null;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: "#060611",
        overflowX: "hidden",
      }}
    >
      {/* ── Ambient glow ── */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
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
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "-10%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "5%",
            right: "-8%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(123,79,212,0.07) 0%, transparent 70%)",
          }}
        />
        {/* Warm burn glow when card is alive */}
        {hasAlive && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "70%",
              height: "40%",
              background: "radial-gradient(ellipse at 50% 100%, rgba(220,60,0,0.1) 0%, transparent 70%)",
            }}
          />
        )}
      </div>

      {/* ── Content layer ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* State 2: alive card — always show burn option */}
        {hasAlive && aliveCard && (
          <AliveWithBurn
            card={aliveCard}
            burnState={burnState}
            onBurnClick={() => setBurnState("confirm")}
            onBurnCancel={() => setBurnState("idle")}
            onBurnConfirm={() => {
              setBurnState("idle");
              onInitiateBurn();
            }}
            onSkipCeremony={onSkipCeremony}
          />
        )}

        {/* State 1: no alive card — normal mint flow */}
        {!hasAlive && (
          <>
            {phase === "select" ? (
              <SelectPhase cars={cars} onSelect={handleSelect} />
            ) : selected ? (
              <MintPhase car={selected} onBack={handleBack} hideBack={cars.length <= 1} />
            ) : null}
          </>
        )}

        {/* Ghost archive — shown whenever there are burned cards */}
        {ghostCards.length > 0 && (
          <GhostArchive ghosts={ghostCards} />
        )}
      </div>

      {/* ── Global styles ── */}
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

        .burn-btn:hover {
          background: rgba(220,38,38,0.2) !important;
          border-color: rgba(220,38,38,0.6) !important;
          box-shadow: 0 0 24px rgba(220,38,38,0.2);
        }
        .burn-btn:focus-visible {
          outline: 2px solid rgba(220,38,38,0.7);
          outline-offset: 2px;
        }

        .cancel-btn:hover {
          background: rgba(255,255,255,0.08) !important;
          border-color: rgba(255,255,255,0.18) !important;
        }
        .cancel-btn:focus-visible {
          outline: 2px solid rgba(200,190,255,0.6);
          outline-offset: 2px;
        }

        .confirm-burn-btn:hover {
          background: rgba(220,38,38,0.28) !important;
          border-color: rgba(220,38,38,0.7) !important;
        }
        .confirm-burn-btn:focus-visible {
          outline: 2px solid rgba(220,38,38,0.7);
          outline-offset: 2px;
        }

        .skip-ceremony-btn:hover {
          background: rgba(255,255,255,0.06) !important;
          color: rgba(200,190,255,0.65) !important;
        }
        .skip-ceremony-btn:focus-visible {
          outline: 2px solid rgba(200,190,255,0.4);
          outline-offset: 2px;
        }

        @keyframes alivePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(48,209,88,0.25); }
          50%       { box-shadow: 0 0 0 6px rgba(48,209,88,0.08); }
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
