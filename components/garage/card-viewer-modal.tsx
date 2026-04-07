"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { TradingCard } from "./trading-card";
import { ERA_COLORS, safeEra } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

interface CardViewerModalProps {
  cards: MintedCard[];
  carLabel: string;
  startIndex?: number;
  onClose: () => void;
}

export function CardViewerModal({ cards, carLabel, startIndex, onClose }: CardViewerModalProps) {
  const initial = startIndex ?? cards.length - 1;
  const [idx, setIdx] = useState(Math.max(0, Math.min(initial, cards.length - 1)));
  const [copied, setCopied] = useState(false);

  const card = cards[idx];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft"  && idx > 0)               setIdx((i) => i - 1);
      if (e.key === "ArrowRight" && idx < cards.length - 1) setIdx((i) => i + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, idx, cards.length]);

  if (!card) return null;

  const snap     = card.car_snapshot;
  const era      = safeEra(card.era);
  const eraStyle = ERA_COLORS[era];
  const edition  = idx + 1;
  const mintedDate = new Date(card.minted_at).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  function handleShare() {
    const url = `${window.location.origin}/cards/${card.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pixel card viewer — ${carLabel}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
        background: "rgba(3,3,10,0.96)",
        backdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "cvFadeIn 0.22s ease-out",
        cursor: "pointer",
        overflowY: "auto",
      }}
    >
      <style>{`
        @keyframes cvFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cvSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        .cv-panel { animation: cvSlideUp 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        style={{
          position: "fixed", top: 18, right: 18,
          width: 40, height: 40, borderRadius: 12,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 9991,
        }}
      >
        <X size={16} />
      </button>

      {/* Copied toast */}
      {copied && (
        <div style={{
          position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
          padding: "8px 18px", borderRadius: 10,
          background: "rgba(48,209,88,0.14)", border: "1px solid rgba(48,209,88,0.4)",
          color: "#30d158", fontFamily: "ui-monospace, monospace",
          fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase",
          zIndex: 9992,
        }}>
          Copied!
        </div>
      )}

      {/* Main panel: card + info side by side */}
      <div
        className="cv-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 32,
          maxWidth: 860,
          width: "100%",
          cursor: "default",
        }}
      >
        {/* LEFT: card + nav arrows */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          {cards.length > 1 && (
            <button
              onClick={() => idx > 0 && setIdx(idx - 1)}
              disabled={idx === 0}
              aria-label="Previous edition"
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.25 : 1,
              }}
            >
              <ChevronLeft size={18} />
            </button>
          )}

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
            edition={cards.length > 1 ? edition : null}
            carLabel={carLabel}
            scale={1.1}
            idle
            interactive
            showShare
            onShare={handleShare}
          />

          {cards.length > 1 && (
            <button
              onClick={() => idx < cards.length - 1 && setIdx(idx + 1)}
              disabled={idx === cards.length - 1}
              aria-label="Next edition"
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: idx === cards.length - 1 ? "not-allowed" : "pointer", opacity: idx === cards.length - 1 ? 0.25 : 1,
              }}
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* RIGHT: info panel */}
        <div style={{
          flex: 1, minWidth: 0,
          padding: "20px 22px",
          borderRadius: 18,
          background: "rgba(255,255,255,0.028)",
          border: "1px solid rgba(255,255,255,0.07)",
          maxHeight: 480,
          overflowY: "auto",
        }}>
          {/* Car label */}
          <h2 style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, fontWeight: 900, color: "rgba(240,230,255,0.9)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 4px" }}>
            {carLabel}
          </h2>

          {/* Edition + card number row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {cards.length > 1 && (
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(200,180,240,0.55)", letterSpacing: "0.15em" }}>
                Edition {edition} of {cards.length}
              </span>
            )}
            {card.card_number != null && (
              <div style={{
                fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 900,
                color: eraStyle.text, padding: "2px 8px", borderRadius: 5,
                background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                letterSpacing: "0.1em",
              }}>
                #{String(card.card_number).padStart(4, "0")}
              </div>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 20,
              background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
              boxShadow: `0 0 8px ${eraStyle.glow}`,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: eraStyle.text }} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: eraStyle.text }}>
                {era} Era
              </span>
            </div>
          </div>

          {/* Mint date */}
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(245,215,110,0.7)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
            Minted {mintedDate}
          </p>

          {/* Flavor text */}
          {card.flavor_text && (
            <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(123,79,212,0.08)", border: "1px solid rgba(123,79,212,0.2)" }}>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, fontStyle: "italic", color: "rgba(200,185,230,0.72)", lineHeight: 1.65, margin: 0 }}>
                {card.flavor_text}
              </p>
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Horsepower", value: card.hp != null ? `${card.hp} hp` : "—" },
              { label: "Mods",       value: card.mod_count != null ? String(card.mod_count) : "—" },
              { label: "Color",      value: snap.color ?? "—" },
              { label: "Trim",       value: snap.trim ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: "rgba(160,140,200,0.38)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 2 }}>{label}</p>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: "rgba(230,220,255,0.82)" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Mod list */}
          {snap.mods && snap.mods.length > 0 && (
            <div>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: "rgba(160,140,200,0.35)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>
                Mods at mint ({snap.mods.length})
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {snap.mods.map((m, i) => (
                  <li key={i} style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(200,185,230,0.65)", lineHeight: 1.8, display: "flex", gap: 6 }}>
                    <span style={{ color: "#7b4fd4", flexShrink: 0 }}>›</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Story */}
          {snap.description && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: "rgba(160,140,200,0.35)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>Story</p>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(200,185,230,0.6)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {snap.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <p style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        fontFamily: "ui-monospace, monospace", fontSize: 10,
        color: "rgba(255,255,255,0.2)", letterSpacing: "0.18em", textTransform: "uppercase",
        pointerEvents: "none",
      }}>
        {cards.length > 1 ? "← → editions · " : ""}F to flip · Esc to close
      </p>
    </div>
  );
}
