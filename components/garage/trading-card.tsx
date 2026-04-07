"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Share2, ShieldCheck, RotateCcw } from "lucide-react";
import { CARD_BORDER_COLOR, CARD_BORDER_GLOW, CARD_GOLD, ERA_COLORS, safeEra } from "@/lib/pixel-card";

export interface TradingCardData {
  cardUrl: string;
  nickname: string;
  generatedAt: string | null;
  hp: number | null;
  modCount: number | null;
  buildScore: number | null;
  vinVerified?: boolean;
  cardNumber?: number | null;
  era?: string | null;
  flavorText?: string | null;
  mods?: string[];
  edition?: number | null;
}

interface TradingCardProps extends TradingCardData {
  carLabel: string;
  scale?: number;
  idle?: boolean;
  interactive?: boolean;
  showShare?: boolean;
  onShare?: () => void;
}

const CARD_W   = 280;
const HEADER_H = 40;
const ART_H    = 200;
const ERA_H    = 26;
const STATS_H  = 70;
const FLAVOR_H = 52;
const FOOTER_H = 32;
const CARD_H   = HEADER_H + ART_H + ERA_H + STATS_H + FLAVOR_H + FOOTER_H; // 420

const PIXEL_TEXTURE = [
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 4px)",
  "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 4px)",
].join(", ");

const SHIMMER_RAINBOW =
  "conic-gradient(from 0deg, rgba(255,80,80,0.55), rgba(255,200,80,0.55), rgba(80,255,140,0.55), rgba(80,180,255,0.55), rgba(200,80,255,0.55), rgba(255,80,80,0.55))";

// 15×15 decorative QR-style grid for card back
const DECO = [
  1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,
  1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,
  1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,
  1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,
  1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,
  1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,
  1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  1,1,1,0,1,0,1,0,0,1,1,1,1,1,1,
  0,0,1,0,0,1,0,0,0,1,0,0,0,0,1,
  0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,
  1,0,0,0,0,1,0,0,0,1,0,1,1,0,1,
  0,1,1,0,1,0,1,0,0,1,0,0,0,0,1,
  0,0,1,0,0,1,0,0,0,1,1,1,1,1,1,
  1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,
];

function fmt(n: number): string {
  return String(n).padStart(4, "0");
}

export function TradingCard({
  cardUrl,
  nickname,
  generatedAt,
  hp,
  modCount,
  buildScore,
  vinVerified = false,
  cardNumber,
  era: eraProp,
  flavorText,
  mods = [],
  edition,
  carLabel,
  scale = 1,
  idle = true,
  interactive = true,
  showShare = false,
  onShare,
}: TradingCardProps) {
  const era      = safeEra(eraProp);
  const eraStyle = ERA_COLORS[era];

  const outerRef   = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5, over: false });
  const rafRef     = useRef(0);
  const [flipped, setFlipped] = useState(false);

  const parts     = carLabel.split(" ");
  const yearMatch = parts[0]?.match(/^\d{4}$/);
  const yearStr   = yearMatch ? parts[0] : "";
  const nameStr   = yearMatch ? parts.slice(1).join(" ") : carLabel;

  const mintDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })
    : "--/--/--";

  // F key flips the card
  useEffect(() => {
    if (!interactive) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if ((e.key === "f" || e.key === "F") && !["INPUT","TEXTAREA"].includes(tag)) {
        setFlipped((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive]);

  const scheduleTilt = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!outerRef.current || !pointerRef.current.over) return;
      const { x, y } = pointerRef.current;
      const rx = (y - 0.5) * -20;
      const ry = (x - 0.5) * 20;
      outerRef.current.style.transform = `perspective(900px) scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg)`;
      if (shimmerRef.current) {
        const angle = Math.round((x + y) * 360);
        shimmerRef.current.style.background = `
          radial-gradient(circle at ${x*100}% ${y*100}%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 22%, transparent 55%),
          ${SHIMMER_RAINBOW}`;
        shimmerRef.current.style.transform = `rotate(${angle}deg)`;
        shimmerRef.current.style.opacity = "0.28";
      }
      if (pointerRef.current.over) scheduleTilt();
    });
  }, [scale]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      over: true,
    };
    scheduleTilt();
  }

  function onMouseLeave() {
    if (!interactive) return;
    pointerRef.current.over = false;
    if (outerRef.current) {
      outerRef.current.style.transition = "transform 0.55s cubic-bezier(0.23,1,0.32,1)";
      outerRef.current.style.transform = `perspective(900px) scale(${scale}) rotateX(0deg) rotateY(0deg)`;
      setTimeout(() => { if (outerRef.current) outerRef.current.style.transition = ""; }, 550);
    }
    if (shimmerRef.current) {
      shimmerRef.current.style.transition = "opacity 0.35s";
      shimmerRef.current.style.opacity = "0";
      setTimeout(() => { if (shimmerRef.current) shimmerRef.current.style.transition = ""; }, 350);
    }
  }

  const scaleKey = scale.toString().replace(".", "_");

  return (
    <div style={{ width: CARD_W * scale, height: CARD_H * scale, position: "relative" }}>
      <style>{`
        @keyframes tcFloat_${scaleKey} {
          0%,100% { transform: perspective(900px) scale(${scale}) translateY(0px) rotate(-0.5deg); }
          50%      { transform: perspective(900px) scale(${scale}) translateY(-5px) rotate(0.5deg); }
        }
        .tc-idle-${scaleKey} { animation: tcFloat_${scaleKey} 3.2s ease-in-out infinite; }
        .tc-idle-${scaleKey}:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .tc-idle-${scaleKey} { animation: none !important; } }
      `}</style>

      {/* Tilt + idle outer wrapper */}
      <div
        ref={outerRef}
        className={idle ? `tc-idle-${scaleKey}` : ""}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          width: CARD_W,
          height: CARD_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          transformStyle: "preserve-3d",
          position: "relative",
          willChange: "transform",
          cursor: interactive ? "default" : "pointer",
        }}
      >
        {/* Holographic shimmer */}
        <div
          ref={shimmerRef}
          style={{
            position: "absolute",
            inset: -40,
            pointerEvents: "none",
            zIndex: 40,
            mixBlendMode: "overlay",
            opacity: 0,
            borderRadius: 16,
            transition: "background 0.04s linear",
          }}
        />

        {/* Flip container */}
        <div
          style={{
            width: CARD_W,
            height: CARD_H,
            position: "relative",
            transformStyle: "preserve-3d",
            transition: "transform 0.65s cubic-bezier(0.4,0,0.2,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >

          {/* ══════════ FRONT FACE ════════════════════════════════════════ */}
          <div style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: 14,
            border: `2px solid ${CARD_BORDER_COLOR}`,
            boxShadow: `0 0 22px ${eraStyle.glow}, 0 0 6px ${CARD_BORDER_GLOW}, 0 10px 36px rgba(0,0,0,0.75)`,
            background: `${PIXEL_TEXTURE}, linear-gradient(158deg, #0e0e1c 0%, #110f1d 55%, #09090f 100%)`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>

            {/* HEADER */}
            <div style={{
              height: HEADER_H, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 12px 0 14px",
              background: "rgba(5,5,12,0.85)",
              borderBottom: `1px solid rgba(123,79,212,0.14)`,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, overflow: "hidden", flex: 1 }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 900, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "rgba(200,180,240,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {nameStr}
                </span>
                {yearStr && (
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: "rgba(160,140,200,0.4)", flexShrink: 0 }}>
                    {yearStr}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: 8 }}>
                {edition != null && edition > 1 && (
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 7, color: "rgba(200,180,240,0.3)", letterSpacing: "0.1em" }}>
                    Ed.{edition}
                  </span>
                )}
                {cardNumber != null && (
                  <div style={{
                    fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 900,
                    color: eraStyle.text, letterSpacing: "0.1em",
                    padding: "2px 6px", borderRadius: 4,
                    background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                  }}>
                    #{fmt(cardNumber)}
                  </div>
                )}
              </div>
            </div>

            {/* ART ZONE */}
            <div style={{
              height: ART_H, flexShrink: 0, position: "relative",
              background: "rgba(5,5,12,0.65)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 65%, ${eraStyle.glow} 0%, transparent 68%)`, pointerEvents: "none" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cardUrl} alt={nickname} width={240} height={180}
                style={{ width: 240, height: 180, objectFit: "contain", imageRendering: "pixelated", position: "relative", zIndex: 2 }}
              />
              {vinVerified && (
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 3, padding: "3px 7px", borderRadius: 5, background: "rgba(245,215,110,0.12)", border: "1px solid rgba(245,215,110,0.5)", zIndex: 5 }}>
                  <ShieldCheck size={8} style={{ color: CARD_GOLD }} />
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 900, letterSpacing: "0.15em", color: CARD_GOLD, textTransform: "uppercase" as const }}>VIN</span>
                </div>
              )}
              <div style={{ position: "absolute", bottom: 5, left: 10, fontFamily: "ui-monospace, monospace", fontSize: 6, fontWeight: 900, letterSpacing: "0.28em", color: "rgba(160,140,200,0.18)", userSelect: "none", zIndex: 3 }}>
                MODVAULT
              </div>
            </div>

            {/* ERA STRIP */}
            <div style={{
              height: ERA_H, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(5,5,12,0.92)",
              borderTop: `1px solid rgba(123,79,212,0.15)`,
              borderBottom: `1px solid rgba(123,79,212,0.15)`,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "3px 12px", borderRadius: 20,
                background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                boxShadow: `0 0 10px ${eraStyle.glow}`,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: eraStyle.text, boxShadow: `0 0 6px ${eraStyle.text}` }} />
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: eraStyle.text }}>
                  {era} Era
                </span>
              </div>
            </div>

            {/* STATS */}
            <div style={{
              height: STATS_H, flexShrink: 0,
              background: "rgba(7,7,14,0.78)",
              padding: "8px 14px 4px",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                {[
                  { label: "PWR",   value: hp != null ? String(hp) : "—" },
                  { label: "MODS",  value: modCount != null ? String(modCount) : "—" },
                  { label: "SCORE", value: buildScore != null ? String(buildScore) : "—" },
                  { label: "MINT",  value: mintDate },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 6, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(160,140,200,0.38)" }}>
                      {label}
                    </span>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 900, color: "rgba(238,228,255,0.92)", letterSpacing: "-0.01em" }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: `linear-gradient(90deg, transparent, rgba(123,79,212,0.38), transparent)` }} />
            </div>

            {/* FLAVOR TEXT */}
            <div style={{
              height: FLAVOR_H, flexShrink: 0,
              background: "rgba(5,5,10,0.75)",
              padding: "9px 14px",
              display: "flex", alignItems: "center", overflow: "hidden",
            }}>
              <p style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8, fontStyle: "italic",
                color: flavorText ? "rgba(200,185,230,0.58)" : "rgba(255,255,255,0.1)",
                lineHeight: 1.6, margin: 0,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical" as const,
              }}>
                {flavorText ?? "—"}
              </p>
            </div>

            {/* FOOTER */}
            <div style={{
              height: FOOTER_H, flexShrink: 0,
              background: "rgba(5,5,12,0.94)",
              display: "flex", alignItems: "center",
              padding: "0 10px", gap: 6,
            }}>
              {interactive && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
                  title="Flip card [F]"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(200,180,240,0.3)", padding: 4, display: "flex", flexShrink: 0 }}
                >
                  <RotateCcw size={10} />
                </button>
              )}
              <span style={{
                flex: 1, fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 900,
                color: CARD_GOLD, letterSpacing: "0.05em", textTransform: "uppercase" as const,
                textAlign: "center" as const, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
              }}>
                {nickname}
              </span>
              {showShare && onShare && (
                <button onClick={(e) => { e.stopPropagation(); onShare(); }} title="Share"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(200,180,240,0.3)", padding: 4, display: "flex", flexShrink: 0 }}>
                  <Share2 size={10} />
                </button>
              )}
            </div>
          </div>

          {/* ══════════ BACK FACE ══════════════════════════════════════════ */}
          <div style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: 14,
            border: `2px solid ${CARD_BORDER_COLOR}`,
            boxShadow: `0 0 22px ${eraStyle.glow}, 0 10px 36px rgba(0,0,0,0.75)`,
            background: `${PIXEL_TEXTURE}, linear-gradient(158deg, #0a0a18 0%, #0f0d1c 55%, #090910 100%)`,
            display: "flex", flexDirection: "column", overflow: "hidden", alignItems: "center",
          }}>
            {/* Back header */}
            <div style={{ width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,5,12,0.88)", borderBottom: `1px solid rgba(123,79,212,0.2)`, flexShrink: 0 }}>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 900, letterSpacing: "0.35em", color: CARD_BORDER_COLOR, textTransform: "uppercase" as const }}>
                MODVAULT
              </span>
            </div>

            {/* Decorative pixel grid */}
            <div style={{ padding: "14px 0 10px", flexShrink: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(15, 5px)", gridTemplateRows: "repeat(15, 5px)", gap: 1.5 }}>
                {DECO.map((cell, i) => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: 0.5,
                    background: cell ? `${CARD_BORDER_COLOR}85` : "rgba(255,255,255,0.04)",
                  }} />
                ))}
              </div>
            </div>

            {/* Era + card number */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexShrink: 0 }}>
              <div style={{ padding: "3px 10px", borderRadius: 20, background: eraStyle.bg, border: `1px solid ${eraStyle.border}`, fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 900, color: eraStyle.text, letterSpacing: "0.2em", textTransform: "uppercase" as const }}>
                {era}
              </div>
              {cardNumber != null && (
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, color: "rgba(200,180,240,0.55)", letterSpacing: "0.15em" }}>
                  #{fmt(cardNumber)}
                </span>
              )}
            </div>

            {/* Mint date */}
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, color: "rgba(200,180,240,0.4)", textAlign: "center", letterSpacing: "0.12em", marginBottom: 8, flexShrink: 0 }}>
              MINTED {mintDate}
            </p>

            {/* Mod list */}
            <div style={{ flex: 1, width: "100%", padding: "0 14px 8px", overflowY: "hidden" }}>
              {mods.length > 0 ? (
                <>
                  <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(160,140,200,0.32)", textTransform: "uppercase" as const, marginBottom: 5 }}>
                    Mods at mint
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {mods.slice(0, 9).map((m, i) => (
                      <li key={i} style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, color: "rgba(200,185,230,0.62)", lineHeight: 1.8, display: "flex", gap: 5 }}>
                        <span style={{ color: CARD_BORDER_COLOR, flexShrink: 0 }}>›</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{m}</span>
                      </li>
                    ))}
                    {mods.length > 9 && (
                      <li style={{ fontFamily: "ui-monospace, monospace", fontSize: 7, color: "rgba(200,185,230,0.28)", fontStyle: "italic", marginTop: 2 }}>
                        +{mods.length - 9} more
                      </li>
                    )}
                  </ul>
                </>
              ) : (
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, color: "rgba(200,185,230,0.22)", fontStyle: "italic", textAlign: "center", marginTop: 8 }}>
                  Stock build
                </p>
              )}
            </div>

            {/* Back footer */}
            <div style={{ width: "100%", height: 38, background: "rgba(5,5,12,0.94)", borderTop: `1px solid rgba(123,79,212,0.18)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0 }}>
              {interactive && (
                <button onClick={(e) => { e.stopPropagation(); setFlipped(false); }} title="Flip [F]"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(200,180,240,0.35)", padding: 4, display: "flex" }}>
                  <RotateCcw size={10} />
                </button>
              )}
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, color: "rgba(200,180,240,0.38)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                {nickname}
              </span>
            </div>
          </div>

        </div>{/* /flip container */}
      </div>{/* /outer wrapper */}

      {/* Unused but exported — suppress TS unused warning */}
      {false && <span style={{ display: "none" }}>{CARD_BORDER_GLOW}</span>}
    </div>
  );
}
