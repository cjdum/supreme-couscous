"use client";

import { useRef, useState, useCallback } from "react";
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
  occasion?: string | null;
  mods?: string[];
  modsDetail?: { name: string; cost: number | null; category?: string }[];
  edition?: number | null;
  torque?: number | null;
  zeroToSixty?: number | null;
  totalInvested?: number | null;
}

interface TradingCardProps extends TradingCardData {
  carLabel: string;
  scale?: number;
  idle?: boolean;
  interactive?: boolean;
  showShare?: boolean;
  onShare?: () => void;
  /** Controlled flip state. If provided, the component uses this instead of internal state. */
  flipped?: boolean;
  /** Called when the user clicks a flip button (controlled mode). */
  onFlipChange?: (v: boolean) => void;
}

const CARD_W   = 280;
const HEADER_H = 40;
const ART_H    = 200;
const ERA_H    = 26;
const STATS_H  = 70;
const FOOTER_H = 32;
// Flavor text removed from card face — lives in the side panel only.
const CARD_H   = HEADER_H + ART_H + ERA_H + STATS_H + FOOTER_H; // 368

const PIXEL_TEXTURE = [
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 4px)",
  "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 4px)",
].join(", ");


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
  occasion,
  mods = [],
  modsDetail,
  edition,
  torque,
  zeroToSixty,
  totalInvested,
  carLabel,
  scale = 1,
  idle = true,
  interactive = true,
  showShare = false,
  onShare,
  flipped: flippedProp,
  onFlipChange,
}: TradingCardProps) {
  const era      = safeEra(eraProp);
  const eraStyle = ERA_COLORS[era];

  // outerRef is the tilt div (center-center scaled)
  const outerRef   = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5, over: false });
  const rafRef     = useRef(0);

  // Controlled vs uncontrolled flip
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isControlled = flippedProp !== undefined;
  const flipped = isControlled ? flippedProp : internalFlipped;

  function doFlip(v: boolean) {
    if (!isControlled) setInternalFlipped(v);
    onFlipChange?.(v);
  }

  const parts     = carLabel.split(" ");
  const yearMatch = parts[0]?.match(/^\d{4}$/);
  const yearStr   = yearMatch ? parts[0] : "";
  const nameStr   = yearMatch ? parts.slice(1).join(" ") : carLabel;

  const mintDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })
    : "--/--/--";

  const scheduleTilt = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!outerRef.current || !pointerRef.current.over) return;
      const { x, y } = pointerRef.current;
      // ±6 deg max, scale 1.02 on hover — centered pivot
      const rx = (y - 0.5) * -12; // maps 0-1 → -6..+6
      const ry = (x - 0.5) * 12;
      outerRef.current.style.transform = `perspective(900px) scale(${scale * 1.02}) rotateX(${rx}deg) rotateY(${ry}deg)`;
      // Soft white glare — low opacity radial following mouse
      if (shimmerRef.current) {
        shimmerRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 70%)`;
        shimmerRef.current.style.opacity = "1";
      }
      if (pointerRef.current.over) scheduleTilt();
    });
  }, [scale]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    // Measure against the outer wrapper (which is CARD_W*scale × CARD_H*scale)
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    pointerRef.current = {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      over: true,
    };
    scheduleTilt();
  }

  function onMouseLeave() {
    if (!interactive) return;
    pointerRef.current.over = false;
    if (outerRef.current) {
      // Smooth snap-back. Keep the transform set to the base `scale(${scale})`
      // permanently — never clear the inline transform, which would otherwise
      // cause a 1-frame flash of "no transform" and a visible jolt.
      outerRef.current.style.transition = "transform 300ms cubic-bezier(0.23,1,0.32,1)";
      outerRef.current.style.transform = `scale(${scale})`;
      setTimeout(() => {
        if (outerRef.current) {
          // Reset transition to the 80ms default so the next hover feels responsive.
          outerRef.current.style.transition = "transform 80ms ease";
        }
      }, 310);
    }
    if (shimmerRef.current) {
      shimmerRef.current.style.transition = "opacity 0.3s";
      shimmerRef.current.style.opacity = "0";
      setTimeout(() => {
        if (shimmerRef.current) shimmerRef.current.style.transition = "";
      }, 310);
    }
  }

  // Unique key per scale value for scoped CSS animation name
  const scaleKey = scale.toString().replace(".", "_");

  return (
    // ── Outer wrapper: mouse events, sized to scaled card ───────────────────
    <div
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        width: CARD_W * scale,
        height: CARD_H * scale,
        position: "relative",
        cursor: interactive ? "default" : "pointer",
      }}
    >
      <style>{`
        @keyframes tcFloat_${scaleKey} {
          0%,100% { transform: translateY(0px) rotate(-0.4deg); }
          50%      { transform: translateY(-5px) rotate(0.4deg); }
        }
        .tc-idle-${scaleKey} {
          animation: tcFloat_${scaleKey} 3.2s ease-in-out infinite;
        }
        .tc-idle-${scaleKey}:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-idle-${scaleKey} { animation: none !important; }
        }
      `}</style>

      {/* ── Idle float layer (only translates/rotates, no scale) ─────────── */}
      <div
        className={idle ? `tc-idle-${scaleKey}` : ""}
        style={{ position: "absolute", inset: 0 }}
      >
        {/* ── Tilt + scale layer (center-center origin) ──────────────────── */}
        <div
          ref={outerRef}
          style={{
            width: CARD_W,
            height: CARD_H,
            position: "absolute",
            top: "50%",
            left: "50%",
            marginLeft: -(CARD_W / 2),
            marginTop: -(CARD_H / 2),
            transformOrigin: "center center",
            transform: `scale(${scale})`,
            transformStyle: "preserve-3d",
            transition: "transform 80ms ease",
            willChange: "transform",
          }}
        >
          {/* Soft white glare — follows mouse, no rainbow */}
          <div
            ref={shimmerRef}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 40,
              mixBlendMode: "screen",
              opacity: 0,
              borderRadius: 14,
            }}
          />

          {/* ── Flip container ──────────────────────────────────────────── */}
          <div
            style={{
              width: CARD_W,
              height: CARD_H,
              position: "relative",
              transformStyle: "preserve-3d",
              WebkitTransformStyle: "preserve-3d",
              transition: "transform 0.65s cubic-bezier(0.4,0,0.2,1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              isolation: "isolate",
            }}
          >

            {/* ══════════ FRONT FACE ═══════════════════════════════════ */}
            <div style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(0deg)",
              borderRadius: 14,
              border: `2px solid ${CARD_BORDER_COLOR}`,
              boxShadow: `0 0 22px ${eraStyle.glow}, 0 0 6px ${CARD_BORDER_GLOW}, 0 10px 36px rgba(0,0,0,0.75)`,
              // Solid opaque base color FIRST to prevent any transparency bleed,
              // textures layered on top.
              backgroundColor: "#0b0b14",
              backgroundImage: `${PIXEL_TEXTURE}, linear-gradient(158deg, #0e0e1c 0%, #110f1d 55%, #09090f 100%)`,
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

              {/* ART ZONE — image never shown on back (backfaceVisibility: hidden on this face) */}
              <div style={{
                height: ART_H, flexShrink: 0, position: "relative",
                background: "rgba(5,5,12,0.65)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "visible",
              }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 65%, ${eraStyle.glow} 0%, transparent 68%)`, pointerEvents: "none" }} />
                {/* Era-colored border — no inner padding so the image fills to the frame edge */}
                <div style={{
                  position: "relative",
                  border: `2px solid ${eraStyle.border}`,
                  borderRadius: 6,
                  overflow: "hidden",
                  boxShadow: `0 0 10px ${eraStyle.glow}`,
                  zIndex: 2,
                  lineHeight: 0,
                }}>
                {/* Source images are square (512×512). Render as 192×192 square
                    so nothing is cropped. `contain` is a safety net in case a
                    future generator returns a non-square aspect. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cardUrl} alt={nickname} width={192} height={192}
                  style={{ width: 192, height: 192, objectFit: "contain", imageRendering: "pixelated", display: "block", background: "#0a0a18" }}
                />
                </div>
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

              {/* STATS — HP / Torque / 0-60 / Mods / Invested (dashes when missing) */}
              <div style={{
                height: STATS_H, flexShrink: 0,
                background: "rgba(7,7,14,0.78)",
                padding: "8px 10px 4px",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2 }}>
                  {[
                    { label: "HP",    value: hp != null ? String(hp) : "—" },
                    { label: "TRQ",   value: torque != null ? String(torque) : "—" },
                    { label: "0-60",  value: zeroToSixty != null ? zeroToSixty.toFixed(1) + "s" : "—" },
                    { label: "MODS",  value: modCount != null ? String(modCount) : "—" },
                    { label: "SPENT", value: totalInvested != null && totalInvested > 0
                                              ? "$" + (totalInvested >= 1000 ? (totalInvested / 1000).toFixed(1) + "k" : String(totalInvested))
                                              : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 6, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(160,140,200,0.4)" }}>
                        {label}
                      </span>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 900, color: "rgba(238,228,255,0.94)", letterSpacing: "-0.01em" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: `linear-gradient(90deg, transparent, rgba(123,79,212,0.38), transparent)` }} />
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
                    onClick={(e) => { e.stopPropagation(); doFlip(true); }}
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

            {/* ══════════ BACK FACE — Pokemon-style MODVAULT ══════════ */}
            <div style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              borderRadius: 14,
              border: `2px solid ${CARD_BORDER_COLOR}`,
              boxShadow: `0 0 22px rgba(123,79,212,0.35), 0 10px 36px rgba(0,0,0,0.75)`,
              // Deep purple solid background like a Pokemon card back
              backgroundColor: "#1a0f3d",
              backgroundImage: [
                "radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.28) 0%, transparent 62%)",
                "linear-gradient(135deg, #1e1246 0%, #2a1858 40%, #1a0f3d 100%)",
              ].join(", "),
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {/* Decorative inner border */}
              <div aria-hidden="true" style={{
                position: "absolute", inset: 8,
                border: `2px solid rgba(168,85,247,0.35)`,
                borderRadius: 10, pointerEvents: "none",
              }} />
              <div aria-hidden="true" style={{
                position: "absolute", inset: 14,
                border: `1px solid rgba(200,180,240,0.12)`,
                borderRadius: 6, pointerEvents: "none",
              }} />

              {/* Centered: big MODVAULT logo + wordmark — Pokemon style */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
                position: "relative", zIndex: 2,
              }}>
                {/* Big logo mark */}
                <div style={{
                  width: 96, height: 96, borderRadius: 24,
                  background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                  border: "3px solid rgba(255,255,255,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 32px rgba(168,85,247,0.6), inset 0 2px 12px rgba(255,255,255,0.15)",
                }}>
                  <svg width="52" height="52" viewBox="0 0 14 14" fill="none">
                    <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
                    <circle cx="4.5" cy="10" r="1" fill="white" />
                    <circle cx="9.5" cy="10" r="1" fill="white" />
                  </svg>
                </div>

                {/* MODVAULT wordmark */}
                <p style={{
                  fontFamily: "ui-monospace, monospace", fontSize: 22, fontWeight: 900,
                  letterSpacing: "0.32em", textTransform: "uppercase",
                  color: "#fff", margin: 0,
                  textShadow: "0 0 18px rgba(168,85,247,0.8), 0 2px 4px rgba(0,0,0,0.5)",
                }}>
                  MODVAULT
                </p>
              </div>

              {/* Invisible flip-back button — tap anywhere to flip back */}
              {interactive && (
                <button
                  onClick={(e) => { e.stopPropagation(); doFlip(false); }}
                  title="Flip [F]"
                  aria-label="Flip to front"
                  style={{
                    position: "absolute", inset: 0, zIndex: 3,
                    background: "transparent", border: "none", cursor: "pointer",
                  }}
                />
              )}
            </div>

          </div>{/* /flip container */}
        </div>{/* /tilt + scale layer */}
      </div>{/* /idle float layer */}

      {/* Suppress unused import warning */}
      {false && <span style={{ display: "none" }}>{CARD_BORDER_GLOW}{flavorText}</span>}
    </div>
  );
}
