"use client";

import Link from "next/link";
import { Sparkles, MessageSquare } from "lucide-react";
import type { MintedCard } from "@/lib/pixel-card";

// ── Types ─────────────────────────────────────────────────────────────────────

type FullCard = MintedCard & {
  personality?: string | null;
  card_level?: number | null;
  card_title?: string | null;
  status?: string | null;
  burned_at?: string | null;
  last_words?: string | null;
};

interface CardHubProps {
  liveCard: FullCard | null;
  ghosts: FullCard[];
  allCards: FullCard[];
  carLabels: Record<string, string>;
}

// ── Ghost Row ──────────────────────────────────────────────────────────────────

function GhostRow({ card, carLabel }: { card: FullCard; carLabel: string }) {
  const snap = card.car_snapshot;
  const burnDate = card.burned_at
    ? new Date(card.burned_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const mintDate = new Date(card.minted_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: "18px 0",
        borderBottom: "1px solid rgba(168,85,247,0.08)",
        alignItems: "flex-start",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.pixel_card_url}
        alt={card.card_title ?? card.nickname}
        width={64}
        height={90}
        style={{
          width: 64,
          height: 90,
          objectFit: "cover",
          borderRadius: 8,
          flexShrink: 0,
          filter: "grayscale(0.9) brightness(0.45)",
          border: "1px solid rgba(168,85,247,0.1)",
          imageRendering: "pixelated",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Ghost icon + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2C7.03 2 3 6.03 3 11c0 3.1 1.5 5.85 3.8 7.58V21h10.4v-2.42C19.5 16.85 21 14.1 21 11c0-4.97-4.03-9-9-9z"
              fill="rgba(200,180,240,0.25)"
            />
            <circle cx="9" cy="10.5" r="1" fill="rgba(200,180,240,0.4)" />
            <circle cx="15" cy="10.5" r="1" fill="rgba(200,180,240,0.4)" />
          </svg>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(200,180,240,0.55)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {card.card_title ?? card.nickname}
          </span>
          {card.personality && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(168,85,247,0.45)",
                fontFamily: "ui-monospace, monospace",
                flexShrink: 0,
              }}
            >
              {card.personality}
            </span>
          )}
        </div>

        {/* Car + dates */}
        <p
          style={{
            fontSize: 11,
            color: "rgba(200,180,240,0.3)",
            marginBottom: 4,
          }}
        >
          {carLabel || `${snap.year} ${snap.make} ${snap.model}`}
        </p>
        <p
          style={{
            fontSize: 10,
            color: "rgba(200,180,240,0.2)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.02em",
          }}
        >
          Born {mintDate}
          {burnDate && (
            <span style={{ color: "rgba(248,113,113,0.35)" }}> · Burned {burnDate}</span>
          )}
        </p>

        {/* Last words */}
        {card.last_words && (
          <p
            style={{
              fontSize: 12,
              fontStyle: "italic",
              color: "rgba(200,180,240,0.4)",
              marginTop: 7,
              lineHeight: 1.55,
              borderLeft: "2px solid rgba(168,85,247,0.18)",
              paddingLeft: 10,
            }}
          >
            &ldquo;{card.last_words}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ── CardHub ───────────────────────────────────────────────────────────────────

export function CardHub({ liveCard, ghosts, carLabels }: CardHubProps) {
  const snap = liveCard?.car_snapshot;
  const liveCarLabel = liveCard
    ? (carLabels[liveCard.car_id ?? ""] ?? (snap ? `${snap.year} ${snap.make} ${snap.model}` : ""))
    : "";
  const liveTitle = liveCard?.card_title ?? liveCard?.nickname ?? "";

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "36px 20px 80px",
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(80,40,140,0.07) 0%, transparent 55%)",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: "clamp(22px, 5vw, 30px)",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              color: "rgba(220,205,255,0.9)",
              marginBottom: 6,
            }}
          >
            Ghost Cards
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "rgba(200,180,240,0.4)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.06em",
            }}
          >
            {ghosts.length === 0
              ? "No ghosts yet"
              : `${ghosts.length} ${ghosts.length === 1 ? "ghost" : "ghosts"} in the vault`}
          </p>
        </div>

        {/* ── Living card callout ── */}
        {liveCard && (
          <Link
            href="/card-chat"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              borderRadius: 16,
              marginBottom: 32,
              background: "rgba(48,209,88,0.05)",
              border: "1px solid rgba(48,209,88,0.18)",
              textDecoration: "none",
              transition: "background 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(48,209,88,0.09)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(48,209,88,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(48,209,88,0.05)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(48,209,88,0.18)";
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={liveCard.pixel_card_url}
              alt={liveTitle}
              width={44}
              height={62}
              style={{
                width: 44,
                height: 62,
                objectFit: "cover",
                borderRadius: 7,
                flexShrink: 0,
                border: "1px solid rgba(48,209,88,0.25)",
                imageRendering: "pixelated",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#30d158",
                    boxShadow: "0 0 5px #30d158",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#30d158",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  Alive
                </span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(220,210,255,0.8)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: 2,
                }}
              >
                {liveTitle}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(200,180,240,0.4)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {liveCarLabel}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(48,209,88,0.65)",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.06em",
              }}
            >
              <MessageSquare size={13} />
              Talk
            </div>
          </Link>
        )}

        {/* ── Ghost list or empty state ── */}
        {ghosts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: "rgba(123,79,212,0.07)",
                border: "1px dashed rgba(168,85,247,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2C7.03 2 3 6.03 3 11c0 3.1 1.5 5.85 3.8 7.58V21h10.4v-2.42C19.5 16.85 21 14.1 21 11c0-4.97-4.03-9-9-9z"
                  fill="rgba(200,180,240,0.18)"
                />
              </svg>
            </div>
            <div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "rgba(200,180,240,0.55)",
                  marginBottom: 6,
                }}
              >
                No ghosts yet
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(200,180,240,0.3)",
                  maxWidth: 260,
                  lineHeight: 1.6,
                }}
              >
                Burned cards live here forever. Mint your first card to get started.
              </p>
            </div>
            <Link
              href="/mint"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 22px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                background: "rgba(168,85,247,0.14)",
                border: "1px solid rgba(168,85,247,0.35)",
                color: "#e9d5ff",
                textDecoration: "none",
              }}
            >
              <Sparkles size={13} />
              Mint first card
            </Link>
          </div>
        ) : (
          <div>
            {ghosts.map((g) => (
              <GhostRow
                key={g.id}
                card={g}
                carLabel={carLabels[g.car_id ?? ""] ?? ""}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
