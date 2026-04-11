"use client";

import { useRef, useState, useCallback } from "react";
import { RotateCcw, Share2 } from "lucide-react";
import { ERAS, type Era, safeEra, RARITIES, type Rarity, safeRarity } from "@/lib/pixel-card";

/* ── Design Brief: Era badge colors ────────────────────────────────── */
const ERA_BADGE: Record<Era, string> = {
  Dawn:   "#8B6914",
  Chrome: "#6B7280",
  Turbo:  "#DC2626",
  Neon:   "#7C3AED",
  Apex:   "#F59E0B",
};

/* ── Design Brief: Archetype colors ────────────────────────────────── */
const ARCHETYPES = ["Purist","Aggressor","Showboat","Survivor","Sleeper","Devotee","Newcomer"] as const;
type Archetype = typeof ARCHETYPES[number];

const ARCHETYPE_COLOR: Record<Archetype, string> = {
  Purist:     "#60A5FA",
  Aggressor:  "#EF4444",
  Showboat:   "#F59E0B",
  Survivor:   "#6B7280",
  Sleeper:    "#10B981",
  Devotee:    "#8B5CF6",
  Newcomer:   "#F472B6",
};

function safeArchetype(a: string | null | undefined): Archetype | null {
  if (!a) return null;
  return (ARCHETYPES as readonly string[]).includes(a) ? (a as Archetype) : null;
}

/* ── Public data interface ─────────────────────────────────────────── */
export interface TradingCardData {
  cardUrl: string;
  nickname: string;
  generatedAt: string | null;
  cardNumber?: number | null;
  era?: string | null;
  rarity?: string | null;
  flavorText?: string | null;
  occasion?: string | null;
  /** New stats (design brief) — fallback to legacy props if missing */
  power?: number | null;
  build?: number | null;
  rep?: number | null;
  archetype?: string | null;
  isAlive?: boolean;
  /** Legacy props — kept for backward compat; mapped to new stats if new ones absent */
  hp?: number | null;
  modCount?: number | null;
  buildScore?: number | null;
  vinVerified?: boolean;
  mods?: string[];
  modsDetail?: { name: string; cost: number | null; category?: string }[];
  edition?: number | null;
  torque?: number | null;
  zeroToSixty?: number | null;
  totalInvested?: number | null;
  personality?: string | null;
  cardLevel?: number | null;
}

interface TradingCardProps extends TradingCardData {
  carLabel: string;
  scale?: number;
  idle?: boolean;
  interactive?: boolean;
  showShare?: boolean;
  onShare?: () => void;
  flipped?: boolean;
  onFlipChange?: (v: boolean) => void;
  dead?: boolean;
  wiggle?: boolean;
}

/* ── Dimensions (Design Brief: 280×420, 2:3 ratio) ─────────────────── */
const CARD_W = 280;
const CARD_H = 420;

function fmt(n: number): string {
  return String(n).padStart(5, "0");
}

/* ════════════════════════════════════════════════════════════════════ */
export function TradingCard({
  cardUrl,
  nickname,
  generatedAt,
  cardNumber,
  era: eraProp,
  rarity: rarityProp,
  flavorText,
  occasion,
  power: powerProp,
  build: buildProp,
  rep: repProp,
  archetype: archetypeProp,
  isAlive = true,
  hp,
  modCount,
  buildScore,
  vinVerified,
  mods,
  modsDetail,
  edition,
  torque,
  zeroToSixty,
  totalInvested,
  personality,
  cardLevel,
  carLabel,
  scale = 1,
  idle = true,
  interactive = true,
  showShare = false,
  onShare,
  flipped: flippedProp,
  onFlipChange,
  dead = false,
  wiggle = false,
}: TradingCardProps) {
  const era = safeEra(eraProp);
  const eraColor = ERA_BADGE[era];
  const rarity = safeRarity(rarityProp);
  const archetype = safeArchetype(archetypeProp ?? personality);
  const archetypeColor = archetype ? ARCHETYPE_COLOR[archetype] : null;

  // Derive stats: prefer new props, fall back to legacy
  const power = powerProp ?? hp ?? 0;
  const buildStat = buildProp ?? buildScore ?? 0;
  const rep = repProp ?? modCount ?? 0;

  // Refs
  const outerRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5, over: false });
  const rafRef = useRef(0);

  // Controlled vs uncontrolled flip
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isControlled = flippedProp !== undefined;
  const flipped = isControlled ? flippedProp : internalFlipped;

  function doFlip(v: boolean) {
    if (!isControlled) setInternalFlipped(v);
    onFlipChange?.(v);
  }

  // Parse car label
  const parts = carLabel.split(" ");
  const yearMatch = parts[0]?.match(/^\d{4}$/);
  const yearStr = yearMatch ? parts[0] : "";
  const nameStr = yearMatch ? parts.slice(1).join(" ") : carLabel;

  // ── Mouse tilt (design brief: ±12deg, scale 1.02) ───────────────
  const scheduleTilt = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!outerRef.current || !pointerRef.current.over) return;
      const { x, y } = pointerRef.current;
      const rx = (y - 0.5) * -12;
      const ry = (x - 0.5) * 12;
      outerRef.current.style.transform =
        `scale(${scale * 1.02}) rotateX(${rx}deg) rotateY(${ry}deg)`;
      if (shimmerRef.current) {
        shimmerRef.current.style.background =
          `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 40%, transparent 70%)`;
        shimmerRef.current.style.opacity = "1";
      }
      if (pointerRef.current.over) scheduleTilt();
    });
  }, [scale]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
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
      outerRef.current.style.transition = "transform 400ms cubic-bezier(0.23,1,0.32,1)";
      outerRef.current.style.transform = `scale(${scale})`;
      setTimeout(() => {
        if (outerRef.current) outerRef.current.style.transition = "transform 80ms ease";
      }, 410);
    }
    if (shimmerRef.current) {
      shimmerRef.current.style.transition = "opacity 0.3s";
      shimmerRef.current.style.opacity = "0";
      setTimeout(() => {
        if (shimmerRef.current) shimmerRef.current.style.transition = "";
      }, 310);
    }
  }

  const sk = scale.toString().replace(".", "_").replace("-", "n");

  // Status derived from dead or isAlive
  const statusAlive = !dead && isAlive;

  return (
    <div
      className="mv-card-scene"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        width: CARD_W * scale,
        height: CARD_H * scale,
        position: "relative",
        cursor: interactive ? "default" : "pointer",
        perspective: "1200px",
        WebkitPerspective: "1200px",
        transformStyle: "preserve-3d",
        WebkitTransformStyle: "preserve-3d",
      }}
    >
      <style>{`
        @keyframes tcFloat_${sk} {
          0%,100% { top: 0px; }
          50%     { top: -6px; }
        }
        .tc-idle-${sk} {
          animation: tcFloat_${sk} 3.4s ease-in-out infinite;
        }
        .tc-idle-${sk}:hover { animation-play-state: paused; }
        @keyframes tcWiggle_${sk} {
          0%, 100% { top: 0; transform: rotate(0deg); }
          12%  { top: -3px; transform: rotate(-1.4deg); }
          26%  { top: -1px; transform: rotate(1.2deg); }
          41%  { top: -4px; transform: rotate(-0.9deg); }
          58%  { top: -2px; transform: rotate(1.1deg); }
          74%  { top: -3px; transform: rotate(-0.6deg); }
          88%  { top: -1px; transform: rotate(0.8deg); }
        }
        .tc-wiggle-${sk} {
          animation: tcWiggle_${sk} 1.1s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-idle-${sk}, .tc-wiggle-${sk} { animation: none !important; }
        }
      `}</style>

      {/* Idle float / wiggle layer */}
      <div
        className={wiggle ? `tc-wiggle-${sk}` : (idle ? `tc-idle-${sk}` : "")}
        style={{
          position: "absolute", inset: 0,
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
        }}
      >
        {/* Tilt + scale layer */}
        <div
          ref={outerRef}
          style={{
            width: CARD_W, height: CARD_H,
            position: "absolute", top: "50%", left: "50%",
            marginLeft: -(CARD_W / 2), marginTop: -(CARD_H / 2),
            transformOrigin: "center center",
            transform: `scale(${scale})`,
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
            transition: "transform 80ms ease",
            willChange: "transform",
          }}
        >
          {/* Flip container */}
          <div
            className="mv-card"
            style={{
              width: CARD_W, height: CARD_H,
              position: "relative",
              transformStyle: "preserve-3d",
              WebkitTransformStyle: "preserve-3d",
              transition: "transform 0.65s cubic-bezier(0.4,0,0.2,1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* ══════════ FRONT FACE ════════════════════════════════ */}
            <div
              className="mv-card-front"
              style={{
                position: "absolute", inset: 0,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(0deg) translateZ(0.1px)",
                borderRadius: 12,
                border: dead
                  ? "2px solid rgba(180,40,40,0.7)"
                  : "2px solid var(--border-card, #5C4A1E)",
                boxShadow: dead
                  ? "0 0 28px rgba(180,40,40,0.4), 0 8px 32px rgba(0,0,0,0.8)"
                  : "0 0 20px rgba(255,215,0,0.15), 0 0 60px rgba(255,215,0,0.05), 0 8px 32px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,215,0,0.08)",
                backgroundColor: dead ? "#1a0808" : "var(--bg-card, #1a1208)",
                display: "flex",
                flexDirection: "column" as const,
                overflow: "hidden",
              }}
            >
              {/* Inner gold line — physical depth (design brief) */}
              <div aria-hidden style={{
                position: "absolute", inset: 4,
                border: dead
                  ? "1px solid rgba(180,40,40,0.2)"
                  : "1px solid rgba(255, 215, 0, 0.12)",
                borderRadius: 9,
                pointerEvents: "none" as const,
                zIndex: 2,
              }} />

              {/* Noise grain overlay */}
              <div aria-hidden style={{
                position: "absolute", inset: 0,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E\")",
                opacity: 0.035,
                pointerEvents: "none" as const,
                zIndex: 1,
                borderRadius: 10,
              }} />

              {/* Shimmer (follows mouse) */}
              <div
                ref={shimmerRef}
                style={{
                  position: "absolute", inset: 0,
                  pointerEvents: "none" as const,
                  zIndex: 40,
                  mixBlendMode: "screen" as const,
                  opacity: 0,
                  borderRadius: 10,
                }}
              />

              {/* ── HEADER ─────────────────────────────────────── */}
              <div
                className="mv-card-header"
                style={{
                  height: 32, flexShrink: 0, position: "relative", zIndex: 2,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0 12px",
                  background: dead
                    ? "linear-gradient(180deg, rgba(40,10,10,0.85) 0%, rgba(25,5,5,0.75) 100%)"
                    : "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)",
                  borderBottom: dead
                    ? "1px solid rgba(180,40,40,0.5)"
                    : "1px solid var(--border-card, #5C4A1E)",
                }}
              >
                <span style={{
                  fontSize: 10,
                  color: dead ? "rgba(220,150,150,0.6)" : "var(--text-dim, #8B7355)",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.08em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                  flex: 1,
                }}>
                  {nameStr}{yearStr ? ` · ${yearStr}` : ""}
                </span>
                {cardNumber != null && (
                  <span style={{
                    fontSize: 10,
                    color: dead ? "#fca5a5" : "var(--text-accent, #FFD700)",
                    letterSpacing: "0.08em",
                    flexShrink: 0, marginLeft: 8,
                  }}>
                    #{fmt(cardNumber)}
                  </span>
                )}
              </div>

              {/* ── ART AREA ───────────────────────────────────── */}
              <div
                className="mv-card-art"
                style={{
                  flex: 1,
                  position: "relative", zIndex: 2,
                  margin: "0 12px",
                  background: dead ? "#120404" : "var(--bg-void, #0a0a0a)",
                  boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {/* Corner brackets — top-left */}
                <div aria-hidden style={{
                  position: "absolute", top: 6, left: 6, width: 16, height: 16,
                  borderTop: `2px solid ${dead ? "rgba(180,80,80,0.5)" : "var(--text-dim, #8B7355)"}`,
                  borderLeft: `2px solid ${dead ? "rgba(180,80,80,0.5)" : "var(--text-dim, #8B7355)"}`,
                  pointerEvents: "none" as const, zIndex: 4,
                }} />
                {/* Top-right */}
                <div aria-hidden style={{
                  position: "absolute", top: 6, right: 6, width: 16, height: 16,
                  borderTop: `2px solid ${dead ? "rgba(180,80,80,0.5)" : "var(--text-dim, #8B7355)"}`,
                  borderRight: `2px solid ${dead ? "rgba(180,80,80,0.5)" : "var(--text-dim, #8B7355)"}`,
                  pointerEvents: "none" as const, zIndex: 4,
                }} />
                {/* Bottom-right */}
                <div aria-hidden style={{
                  position: "absolute", bottom: 6, right: 6, width: 16, height: 16,
                  borderBottom: `2px solid ${dead ? "rgba(180,80,80,0.5)" : "var(--text-dim, #8B7355)"}`,
                  borderRight: `2px solid ${dead ? "rgba(180,80,80,0.5)" : "var(--text-dim, #8B7355)"}`,
                  pointerEvents: "none" as const, zIndex: 4,
                }} />
                {/* Bottom-left */}
                <div aria-hidden style={{
                  position: "absolute", bottom: 6, left: 6, width: 16, height: 16,
                  borderBottom: `2px solid ${dead ? "rgba(180,80,80,0.5)" : "var(--text-dim, #8B7355)"}`,
                  borderLeft: `2px solid ${dead ? "rgba(180,80,80,0.5)" : "var(--text-dim, #8B7355)"}`,
                  pointerEvents: "none" as const, zIndex: 4,
                }} />

                {/* MODVAULT watermark */}
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontSize: 20, letterSpacing: "0.3em",
                  color: dead ? "rgba(180,60,60,0.1)" : "rgba(255,215,0,0.1)",
                  textTransform: "uppercase" as const,
                  userSelect: "none" as const, zIndex: 1,
                  pointerEvents: "none" as const,
                }}>
                  MODVAULT
                </div>

                {/* Pixel art image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cardUrl}
                  alt={nickname}
                  style={{
                    width: "85%", height: "85%",
                    objectFit: "contain",
                    imageRendering: "pixelated",
                    display: "block",
                    position: "relative", zIndex: 2,
                    filter: dead ? "brightness(0.5) sepia(0.6) hue-rotate(-30deg) saturate(1.1)" : "none",
                  }}
                />

                {/* Burned stamp */}
                {dead && (
                  <div aria-hidden style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%) rotate(-14deg)",
                    padding: "4px 14px", borderRadius: 6,
                    border: "2.5px solid rgba(255,90,90,0.65)",
                    color: "rgba(255,100,100,0.85)",
                    fontSize: 15, letterSpacing: "0.3em",
                    textTransform: "uppercase" as const,
                    background: "rgba(20,0,0,0.55)",
                    boxShadow: "0 0 20px rgba(180,40,40,0.4), inset 0 0 10px rgba(180,40,40,0.3)",
                    pointerEvents: "none" as const, zIndex: 5,
                    textShadow: "0 0 8px rgba(180,40,40,0.6)",
                  }}>
                    Burned
                  </div>
                )}
              </div>

              {/* ── ERA + ARCHETYPE BADGES ──────────────────────── */}
              <div
                className="mv-card-badges"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, padding: "5px 12px",
                  position: "relative", zIndex: 2,
                }}
              >
                {/* Era badge */}
                <div
                  className="mv-card-era"
                  style={{
                    padding: "3px 10px", borderRadius: 999,
                    background: dead
                      ? "rgba(180,40,40,0.2)"
                      : `${eraColor}33`,
                    border: `1px solid ${dead ? "rgba(180,40,40,0.5)" : `${eraColor}99`}`,
                    fontSize: 8, letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    color: dead ? "#fca5a5" : eraColor,
                  }}
                >
                  {dead ? "GHOST" : era}
                </div>

                {/* Archetype badge */}
                {archetype && !dead && (
                  <div
                    className="mv-card-archetype"
                    style={{
                      padding: "3px 10px", borderRadius: 999,
                      background: `${archetypeColor}33`,
                      border: `1px solid ${archetypeColor}99`,
                      fontSize: 8, letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      color: archetypeColor!,
                    }}
                  >
                    {archetype}
                  </div>
                )}

                {/* Rarity badge (non-Common only) */}
                {rarity !== "Common" && !dead && (
                  <div style={{
                    padding: "3px 10px", borderRadius: 999,
                    background: rarity === "Legendary"
                      ? "rgba(255,215,0,0.15)"
                      : "rgba(255,255,255,0.06)",
                    border: `1px solid ${rarity === "Legendary" ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.15)"}`,
                    fontSize: 8, letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    color: rarity === "Legendary" ? "#FFD700" : "var(--text-dim, #8B7355)",
                  }}>
                    {rarity}
                  </div>
                )}
              </div>

              {/* ── STATS ROW (POWER / BUILD / REP) ────────────── */}
              <div
                className="mv-card-stats"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  borderTop: dead
                    ? "1px solid rgba(180,40,40,0.4)"
                    : "1px solid var(--border-card, #5C4A1E)",
                  borderBottom: dead
                    ? "1px solid rgba(180,40,40,0.4)"
                    : "1px solid var(--border-card, #5C4A1E)",
                  position: "relative", zIndex: 2,
                }}
              >
                {([
                  { label: "POWER", value: power },
                  { label: "BUILD", value: buildStat },
                  { label: "REP",   value: rep },
                ] as const).map(({ label, value }, i) => (
                  <div
                    key={label}
                    className="mv-stat"
                    style={{
                      display: "flex", flexDirection: "column" as const, alignItems: "center",
                      padding: "6px 4px", gap: 2,
                      borderRight: i < 2
                        ? (dead ? "1px solid rgba(180,40,40,0.4)" : "1px solid var(--border-card, #5C4A1E)")
                        : "none",
                    }}
                  >
                    <span className="mv-stat-label" style={{
                      fontSize: 8,
                      color: dead ? "rgba(180,120,120,0.5)" : "var(--text-dim, #8B7355)",
                      letterSpacing: "0.1em",
                    }}>
                      {label}
                    </span>
                    <span className="mv-stat-value" style={{
                      fontSize: 16,
                      color: dead ? "rgba(240,200,200,0.85)" : "var(--text-primary, #F5E6C8)",
                    }}>
                      {value || "—"}
                    </span>
                  </div>
                ))}
              </div>

              {/* ── CARD NAME ──────────────────────────────────── */}
              <div
                className="mv-card-name"
                style={{
                  textAlign: "center" as const,
                  padding: "8px 10px 4px",
                  position: "relative", zIndex: 2,
                }}
              >
                {interactive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); doFlip(true); }}
                    title="Flip card"
                    style={{
                      position: "absolute", left: 10, top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent", border: "none", cursor: "pointer",
                      color: dead ? "rgba(220,150,150,0.35)" : "var(--text-dim, #8B7355)",
                      padding: 4, display: "flex",
                    }}
                  >
                    <RotateCcw size={10} />
                  </button>
                )}
                <span style={{
                  fontSize: 14,
                  color: dead ? "#fca5a5" : "var(--text-accent, #FFD700)",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.05em",
                  textShadow: dead
                    ? "0 1px 0 rgba(0,0,0,0.8)"
                    : "0 1px 0 rgba(0,0,0,0.8), 0 -1px 0 rgba(255,215,0,0.1)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                  display: "block",
                }}>
                  {nickname}
                </span>
                {showShare && onShare && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onShare(); }}
                    title="Share"
                    style={{
                      position: "absolute", right: 10, top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent", border: "none", cursor: "pointer",
                      color: dead ? "rgba(220,150,150,0.35)" : "var(--text-dim, #8B7355)",
                      padding: 4, display: "flex",
                    }}
                  >
                    <Share2 size={10} />
                  </button>
                )}
              </div>

              {/* ── STATUS INDICATOR ───────────────────────────── */}
              <div
                className="mv-card-status"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, padding: "4px 0 8px",
                  position: "relative", zIndex: 2,
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: dead ? "#6B7280" : (statusAlive ? "#4ADE80" : "#6B7280"),
                  boxShadow: dead ? "none" : (statusAlive ? "0 0 8px #4ADE80" : "none"),
                }} />
                <span style={{
                  fontSize: 8,
                  color: dead ? "rgba(180,120,120,0.5)" : "var(--text-dim, #8B7355)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                }}>
                  {dead ? "BURNED" : (statusAlive ? "ALIVE" : "GHOST")}
                </span>
              </div>
            </div>

            {/* ══════════ BACK FACE ═════════════════════════════ */}
            <div
              className="mv-card-back"
              style={{
                position: "absolute", inset: 0,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg) translateZ(0.1px)",
                borderRadius: 12,
                border: dead
                  ? "2px solid rgba(180,40,40,0.7)"
                  : "2px solid var(--border-card, #5C4A1E)",
                boxShadow: dead
                  ? "0 0 26px rgba(180,40,40,0.45), 0 14px 44px rgba(0,0,0,0.85)"
                  : "0 0 20px rgba(255,215,0,0.15), 0 0 60px rgba(255,215,0,0.05), 0 14px 44px rgba(0,0,0,0.75)",
                backgroundColor: dead ? "#180404" : "var(--bg-card, #1a1208)",
                display: "flex", flexDirection: "column" as const,
                alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                isolation: "isolate" as const,
              }}
            >
              {/* Crosshatch texture */}
              <div aria-hidden style={{
                position: "absolute", inset: 0, zIndex: 0,
                backgroundColor: dead ? "#180404" : "var(--bg-card, #1a1208)",
                backgroundImage: dead ? [
                  "repeating-linear-gradient(45deg, rgba(220,60,60,0.10) 0 2px, transparent 2px 10px)",
                  "repeating-linear-gradient(-45deg, rgba(220,60,60,0.08) 0 2px, transparent 2px 10px)",
                  "radial-gradient(ellipse at 50% 50%, rgba(220,60,60,0.25) 0%, transparent 70%)",
                ].join(", ") : [
                  "repeating-linear-gradient(45deg, rgba(255,215,0,0.04) 0 2px, transparent 2px 10px)",
                  "repeating-linear-gradient(-45deg, rgba(255,215,0,0.03) 0 2px, transparent 2px 10px)",
                  "radial-gradient(ellipse at 50% 50%, rgba(255,215,0,0.12) 0%, transparent 70%)",
                  "linear-gradient(180deg, #1f1608 0%, #1a1208 50%, #0f0a04 100%)",
                ].join(", "),
              }} />

              {/* Tiled MODVAULT stamps */}
              <div aria-hidden style={{
                position: "absolute", inset: 0, zIndex: 1,
                opacity: 0.08,
                backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><g fill='none' stroke='%23FFD700' stroke-width='1.2' stroke-linejoin='round'><path d='M6 18l4-10h8l4 10z'/></g><circle cx='10' cy='19.5' r='1.6' fill='%23FFD700'/><circle cx='18' cy='19.5' r='1.6' fill='%23FFD700'/></svg>\")",
                backgroundSize: "28px 28px",
                backgroundRepeat: "repeat",
              }} />

              {/* Decorative frame */}
              <div aria-hidden style={{
                position: "absolute", inset: 6, zIndex: 2,
                border: `2px solid ${dead ? "rgba(220,60,60,0.4)" : "rgba(255,215,0,0.2)"}`,
                borderRadius: 8, pointerEvents: "none" as const,
                boxShadow: `inset 0 0 14px ${dead ? "rgba(220,60,60,0.15)" : "rgba(255,215,0,0.08)"}`,
              }} />
              <div aria-hidden style={{
                position: "absolute", inset: 12, zIndex: 2,
                border: `1px dashed ${dead ? "rgba(220,60,60,0.2)" : "rgba(255,215,0,0.15)"}`,
                borderRadius: 4, pointerEvents: "none" as const,
              }} />

              {/* Corner diamonds */}
              {([
                { top: 14, left: 14 }, { top: 14, right: 14 },
                { bottom: 14, left: 14 }, { bottom: 14, right: 14 },
              ] as const).map((pos, i) => (
                <div key={i} aria-hidden style={{
                  position: "absolute" as const, zIndex: 2,
                  width: 6, height: 6,
                  background: dead ? "rgba(220,60,60,0.5)" : "rgba(255,215,0,0.4)",
                  transform: "rotate(45deg)",
                  ...pos,
                }} />
              ))}

              {/* Logo + wordmark */}
              <div style={{
                display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 20,
                position: "relative", zIndex: 3,
              }}>
                <div style={{
                  width: 118, height: 118, borderRadius: "50%",
                  background: dead
                    ? "radial-gradient(circle, rgba(40,10,10,0.95) 0%, rgba(24,4,4,0.98) 100%)"
                    : "radial-gradient(circle, rgba(26,18,8,0.95) 0%, rgba(20,14,5,0.98) 100%)",
                  border: `2px solid ${dead ? "rgba(220,60,60,0.5)" : "rgba(255,215,0,0.4)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: dead
                    ? "0 0 30px rgba(220,60,60,0.4), inset 0 0 20px rgba(220,60,60,0.2)"
                    : "0 0 30px rgba(255,215,0,0.2), inset 0 0 20px rgba(255,215,0,0.1), 0 0 0 4px rgba(255,215,0,0.08)",
                  position: "relative",
                }}>
                  <div aria-hidden style={{
                    position: "absolute", inset: 6, borderRadius: "50%",
                    border: `1px solid ${dead ? "rgba(220,60,60,0.4)" : "rgba(255,215,0,0.25)"}`,
                  }} />
                  <div style={{
                    width: 78, height: 78, borderRadius: 20,
                    background: dead
                      ? "linear-gradient(135deg, #8b1a1a 0%, #dc2626 100%)"
                      : "linear-gradient(135deg, #8B6914 0%, #FFD700 100%)",
                    border: "2px solid rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "inset 0 2px 10px rgba(255,255,255,0.15), 0 4px 14px rgba(0,0,0,0.4)",
                  }}>
                    <svg width="44" height="44" viewBox="0 0 14 14" fill="none">
                      <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
                      <circle cx="4.5" cy="10" r="1" fill="white" />
                      <circle cx="9.5" cy="10" r="1" fill="white" />
                    </svg>
                  </div>
                </div>

                <div style={{ textAlign: "center" as const }}>
                  <p style={{
                    fontSize: 19, letterSpacing: "0.34em",
                    textTransform: "uppercase" as const,
                    color: "#fff", margin: "0 0 4px",
                    textShadow: dead
                      ? "0 0 18px rgba(220,60,60,0.9), 0 2px 4px rgba(0,0,0,0.6)"
                      : "0 0 18px rgba(255,215,0,0.6), 0 2px 4px rgba(0,0,0,0.6)",
                  }}>
                    MODVAULT
                  </p>
                  <p style={{
                    fontSize: 7, letterSpacing: "0.38em",
                    textTransform: "uppercase" as const,
                    color: dead ? "rgba(220,60,60,0.5)" : "rgba(255,215,0,0.5)",
                    margin: 0,
                  }}>
                    {dead ? "· Ghost Card ·" : "· Pixel Card ·"}
                  </p>
                </div>
              </div>

              {/* Tap to flip back */}
              {interactive && (
                <button
                  onClick={(e) => { e.stopPropagation(); doFlip(false); }}
                  title="Flip"
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
    </div>
  );
}
