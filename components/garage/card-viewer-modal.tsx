"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { TradingCard } from "./trading-card";
import { ERA_COLORS, safeEra } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";
import { useToast } from "@/components/ui/toast";

interface CardViewerModalProps {
  cards: MintedCard[];
  carLabel: string;
  startIndex?: number;
  onClose: () => void;
}

const ERA_TOOLTIP_TEXT = "Eras are collectible visual themes assigned randomly at mint. Each era has a unique color scheme and border style.";
const EDITION_TOOLTIP_TEXT = "Your card's unique print number. Lower numbers are rarer.";

export function CardViewerModal({ cards, carLabel, startIndex, onClose }: CardViewerModalProps) {
  const initial = startIndex ?? cards.length - 1;
  const [idx, setIdx] = useState(Math.max(0, Math.min(initial, cards.length - 1)));
  const [copied, setCopied] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const toast = useToast();

  // Swipe gesture state
  const touchStartX = useRef<number | null>(null);

  const card = cards[idx];

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Reset flip when switching cards
  useEffect(() => {
    setFlipped(false);
  }, [idx]);

  // Keyboard controls
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (["INPUT", "TEXTAREA"].includes(tag)) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft"  && idx > 0)               { setIdx((i) => i - 1); return; }
      if (e.key === "ArrowRight" && idx < cards.length - 1) { setIdx((i) => i + 1); return; }
      if (e.key === "f" || e.key === "F" || e.key === " ") {
        e.preventDefault();
        setFlipped((prev) => !prev);
      }
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
    const url = `${window.location.origin}/c/${card.id}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        toast.success("Share link copied", { description: "Paste it anywhere — works for anyone.", duration: 3000 });
      })
      .catch(() => {
        toast.error("Couldn't copy link");
      });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function goLeft()  { if (idx > 0)               setIdx(idx - 1); }
  function goRight() { if (idx < cards.length - 1) setIdx(idx + 1); }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goRight(); else goLeft();
  }

  const prevCard = idx > 0 ? cards[idx - 1] : null;
  const nextCard = idx < cards.length - 1 ? cards[idx + 1] : null;

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
        background: "var(--color-bg-glass)",
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
        .cv-panel {
          animation: cvSlideUp 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 32px;
          max-width: 1180px;
          width: 100%;
          cursor: default;
        }
        .cv-card-col {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          /* Constrain width to the main card + a small gutter so peek cards
             clip before they can cross into the description panel. */
          width: 360px;
          max-width: 100%;
          overflow: hidden;
          padding: 20px 0;
        }
        .cv-desc-col {
          flex: 1 1 420px;
          min-width: 0;
          max-width: 460px;
          padding: 22px 24px;
          border-radius: 18px;
          background: var(--mv-panel-bg);
          border: 1px solid var(--mv-panel-border);
          color: var(--mv-panel-text);
          max-height: 78vh;
          overflow-y: auto;
          backdrop-filter: blur(8px);
        }
        @media (max-width: 960px) {
          .cv-panel {
            flex-direction: column;
            gap: 20px;
            padding-top: 6vh;
            padding-bottom: 4vh;
          }
          .cv-desc-col {
            max-height: 40vh;
            width: 100%;
            max-width: 460px;
          }
        }

        /* Hover tooltip — CSS only, no click state */
        .cv-tip { position: relative; display: inline-flex; }
        .cv-tip .cv-tip-body {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          max-width: 180px;
          width: max-content;
          padding: 8px 12px;
          border-radius: 8px;
          background: var(--mv-panel-bg-solid);
          color: var(--mv-panel-text);
          font-family: ui-monospace, monospace;
          font-size: 10px;
          line-height: 1.5;
          letter-spacing: 0.02em;
          white-space: normal;
          text-align: center;
          text-transform: none;
          border: 1px solid var(--mv-panel-border-bright);
          box-shadow: 0 4px 20px rgba(0,0,0,0.35);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;
          z-index: 999;
        }
        .cv-tip .cv-tip-body::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: var(--mv-panel-bg-solid);
        }
        .cv-tip:hover .cv-tip-body,
        .cv-tip:focus-within .cv-tip-body {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
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

      {/* Main panel — horizontal on desktop, stacked on mobile */}
      <div
        className="cv-panel"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Card column: peek cards + nav arrows + current card */}
        <div className="cv-card-col">

          {/* Peek: previous card (tucked behind, mostly hidden) */}
          {prevCard && (
            <div style={{
              position: "absolute",
              right: "calc(50% + 90px)",
              top: "50%",
              transform: "translateY(-50%) rotate(-10deg) scale(0.62)",
              transformOrigin: "right center",
              opacity: 0.4,
              filter: "blur(1px)",
              pointerEvents: "none",
              zIndex: 0,
            }}>
              <TradingCard
                cardUrl={prevCard.pixel_card_url}
                nickname={prevCard.nickname}
                generatedAt={prevCard.minted_at}
                hp={prevCard.hp}
                modCount={prevCard.mod_count}
                buildScore={prevCard.car_snapshot.build_score}
                era={prevCard.era}
                flavorText={prevCard.flavor_text}
                occasion={prevCard.occasion}
                mods={prevCard.car_snapshot.mods ?? []}
                carLabel={carLabel}
                scale={1.1}
                idle={false}
                interactive={false}
              />
            </div>
          )}

          {/* Left nav arrow */}
          {cards.length > 1 && (
            <button
              onClick={() => goLeft()}
              disabled={idx === 0}
              aria-label="Previous edition"
              style={{
                position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)",
                width: 36, height: 36, borderRadius: 10, zIndex: 3,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.2 : 1,
              }}
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Current card — tap anywhere to flip */}
          <div
            style={{ position: "relative", zIndex: 1, cursor: "pointer" }}
            onClick={(e) => {
              // Let inner buttons (share, flip, back-face tap) handle their own clicks;
              // they all call stopPropagation, so this only fires on empty card surface.
              e.stopPropagation();
              setFlipped((f) => !f);
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
              occasion={card.occasion}
              mods={snap.mods ?? []}
              modsDetail={snap.mods_detail}
              torque={snap.torque ?? null}
              zeroToSixty={snap.zero_to_sixty ?? null}
              totalInvested={snap.total_invested ?? null}
              edition={cards.length > 1 ? edition : null}
              carLabel={carLabel}
              scale={1.1}
              idle={false}
              interactive
              showShare
              onShare={handleShare}
              flipped={flipped}
              onFlipChange={setFlipped}
            />
          </div>

          {/* Right nav arrow */}
          {cards.length > 1 && (
            <button
              onClick={() => goRight()}
              disabled={idx === cards.length - 1}
              aria-label="Next edition"
              style={{
                position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)",
                width: 36, height: 36, borderRadius: 10, zIndex: 3,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: idx === cards.length - 1 ? "not-allowed" : "pointer", opacity: idx === cards.length - 1 ? 0.2 : 1,
              }}
            >
              <ChevronRight size={16} />
            </button>
          )}

          {/* Peek: next card (tucked behind, mostly hidden) */}
          {nextCard && (
            <div style={{
              position: "absolute",
              left: "calc(50% + 90px)",
              top: "50%",
              transform: "translateY(-50%) rotate(10deg) scale(0.62)",
              transformOrigin: "left center",
              opacity: 0.4,
              filter: "blur(1px)",
              pointerEvents: "none",
              zIndex: 0,
            }}>
              <TradingCard
                cardUrl={nextCard.pixel_card_url}
                nickname={nextCard.nickname}
                generatedAt={nextCard.minted_at}
                hp={nextCard.hp}
                modCount={nextCard.mod_count}
                buildScore={nextCard.car_snapshot.build_score}
                era={nextCard.era}
                flavorText={nextCard.flavor_text}
                occasion={nextCard.occasion}
                mods={nextCard.car_snapshot.mods ?? []}
                carLabel={carLabel}
                scale={1.1}
                idle={false}
                interactive={false}
              />
            </div>
          )}
        </div>

        {/* Description panel — right column on desktop, below on mobile */}
        <div className="cv-desc-col">
          {/* Car label */}
          <h2 style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 900, color: "rgba(240,230,255,0.9)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 6px" }}>
            {carLabel}
          </h2>

          {/* Edition + card number + era row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {/* Edition number with hover tooltip */}
            {cards.length > 1 && (
              <span className="cv-tip" tabIndex={0}>
                <span style={{
                  fontFamily: "ui-monospace, monospace", fontSize: 10,
                  color: "rgba(200,180,240,0.7)", letterSpacing: "0.12em",
                  textDecoration: "underline dotted rgba(200,180,240,0.4)",
                  cursor: "help",
                }}>
                  Ed. {edition}/{cards.length}
                </span>
                <span className="cv-tip-body">
                  {EDITION_TOOLTIP_TEXT}
                </span>
              </span>
            )}

            {card.card_number != null && (
              <div style={{
                fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 900,
                color: eraStyle.text, padding: "2px 7px", borderRadius: 5,
                background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                letterSpacing: "0.1em",
              }}>
                #{String(card.card_number).padStart(4, "0")}
              </div>
            )}

            {/* Era badge with hover tooltip */}
            <span className="cv-tip" tabIndex={0}>
              <span style={{
                background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                borderRadius: 20, cursor: "help",
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 9px",
                boxShadow: `0 0 8px ${eraStyle.glow}`,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: eraStyle.text, display: "inline-block" }} />
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: eraStyle.text }}>
                  {era}
                </span>
              </span>
              <span className="cv-tip-body">
                {ERA_TOOLTIP_TEXT}
              </span>
            </span>
          </div>

          {/* Mint date */}
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(245,215,110,0.75)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: card.occasion ? 10 : 12 }}>
            Minted {mintedDate}
          </p>

          {/* Occasion note */}
          {card.occasion && (
            <div style={{
              marginBottom: 12, padding: "8px 12px", borderRadius: 10,
              background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
              boxShadow: `0 0 10px ${eraStyle.glow}`,
            }}>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, color: "rgba(160,140,200,0.6)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>
                Occasion
              </p>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontStyle: "italic", color: eraStyle.text, lineHeight: 1.5, margin: 0, letterSpacing: "0.02em" }}>
                &ldquo;{card.occasion}&rdquo;
              </p>
            </div>
          )}

          {/* Flavor text */}
          {card.flavor_text && (
            <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(123,79,212,0.08)", border: "1px solid rgba(123,79,212,0.2)" }}>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: "rgba(160,140,200,0.5)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>
                Card Description
              </p>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, fontStyle: "italic", color: "rgba(200,185,230,0.8)", lineHeight: 1.6, margin: 0 }}>
                {card.flavor_text}
              </p>
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Horsepower", value: card.hp != null ? `${card.hp} hp` : "—" },
              { label: "Mods",       value: card.mod_count != null ? String(card.mod_count) : "—" },
              { label: "Color",      value: snap.color ?? "—" },
              { label: "Trim",       value: snap.trim ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: "rgba(160,140,200,0.5)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 2 }}>{label}</p>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: "rgba(230,220,255,0.9)" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Mod list */}
          {snap.mods && snap.mods.length > 0 && (
            <div>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: "rgba(160,140,200,0.5)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>
                Mods at mint ({snap.mods.length})
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {snap.mods.map((m, i) => (
                  <li key={i} style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(200,185,230,0.75)", lineHeight: 1.8, display: "flex", gap: 6 }}>
                    <span style={{ color: "#a855f7", flexShrink: 0 }}>›</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Story */}
          {snap.description && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: "rgba(160,140,200,0.5)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>Story</p>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(200,185,230,0.7)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
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
        pointerEvents: "none", whiteSpace: "nowrap",
      }}>
        {cards.length > 1 ? "← → editions · " : ""}F / Space to flip · Esc to close
      </p>
    </div>
  );
}
