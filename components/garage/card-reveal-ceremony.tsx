"use client";

import { useEffect, useState } from "react";
import { TradingCard, type TradingCardData } from "./trading-card";

interface CardRevealCeremonyProps {
  card: TradingCardData;
  carLabel: string;
  onComplete: () => void;
}

type Phase =
  | "hidden"
  | "dimming"
  | "pack_present"
  | "pack_shaking"
  | "pack_opening"
  | "card_flying"
  | "card_flipping"
  | "card_settled"
  | "show_continue";

const DISMISSING_PHASES = new Set<Phase>(["card_settled", "show_continue"]);

// 14 gold particles fanning out in a sunburst — computed once
const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * 360;
  const distance = 80 + Math.random() * 60;
  const rad = (angle * Math.PI) / 180;
  const tx = Math.round(Math.cos(rad) * distance);
  const ty = Math.round(Math.sin(rad) * distance);
  const size = 3 + Math.floor(Math.random() * 4);
  return { tx, ty, size, delay: Math.random() * 0.12 };
});

export function CardRevealCeremony({ card, carLabel, onComplete }: CardRevealCeremonyProps) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [particlesActive, setParticlesActive] = useState(false);

  // ── Lock body scroll while overlay is open ─────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Advance through phases ─────────────────────────────────────────────
  // Cumulative timing (total ~2.5s to "tap to continue"):
  //  0ms    → dimming (overlay fade in)
  //  50ms   → pack_present (slides in from top, 0.2s anim)
  //  250ms  → pack_shaking (0.5s shake)
  //  750ms  → pack_opening (pack splits, 0.3s)
  //  1050ms → card_flying  (card scales in, 0.5s)
  //  1550ms → card_flipping (Y-axis flip, 0.8s)
  //  2350ms → card_settled
  //  2500ms → show_continue
  useEffect(() => {
    const q = (delay: number, next: Phase) => setTimeout(() => setPhase(next), delay);

    const t1 = q(0,    "dimming");
    const t2 = q(50,   "pack_present");
    const t3 = q(250,  "pack_shaking");
    const t4 = q(750,  "pack_opening");
    const t5 = q(1050, "card_flying");
    const t6 = q(1550, "card_flipping");
    const t7 = q(2350, "card_settled");
    const t8 = q(2500, "show_continue");

    // Particle burst when card settles
    const tp  = setTimeout(() => setParticlesActive(true),  2350);
    const tp2 = setTimeout(() => setParticlesActive(false), 3200);

    return () => {
      [t1, t2, t3, t4, t5, t6, t7, t8, tp, tp2].forEach(clearTimeout);
    };
  }, []);

  function handleDismiss() {
    if (!DISMISSING_PHASES.has(phase)) return;
    setTimeout(onComplete, 250);
  }

  // ── Derive visual state from phase ────────────────────────────────────
  const overlayVisible  = phase !== "hidden";
  const packVisible     = ["pack_present", "pack_shaking", "pack_opening"].includes(phase);
  const cardVisible     = ["card_flying", "card_flipping", "card_settled", "show_continue"].includes(phase);
  const continueVisible = phase === "show_continue";

  return (
    <>
      <style>{`
        @keyframes packSlideIn {
          from { transform: translateY(-160px); opacity: 0; }
          to   { transform: translateY(0);      opacity: 1; }
        }
        @keyframes packShake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-8px) rotate(-2deg); }
          35%     { transform: translateX(8px)  rotate(2deg); }
          55%     { transform: translateX(-6px) rotate(-1.5deg); }
          75%     { transform: translateX(6px)  rotate(1.5deg); }
        }
        @keyframes packTopOut {
          from { transform: translateY(0);     opacity: 1; }
          to   { transform: translateY(-200px); opacity: 0; }
        }
        @keyframes packBotOut {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(200px); opacity: 0; }
        }
        @keyframes cardFlyIn {
          from { transform: scale(0.05) translateY(60px); opacity: 0; }
          65%  { transform: scale(1.1)  translateY(-6px); opacity: 1; }
          to   { transform: scale(1)    translateY(0);    opacity: 1; }
        }
        @keyframes cardFlip360 {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
        @keyframes particleBurst {
          0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          80%  { opacity: 0.6; }
          100% { transform: translate(calc(-50% + var(--tx) * 1px), calc(-50% + var(--ty) * 1px)) scale(0); opacity: 0; }
        }
        @keyframes tapIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cr-pack-shake, .cr-card-fly, .cr-card-flip { animation: none !important; }
        }
      `}</style>

      {/* ── Full-screen overlay ─────────────────────────────────────────── */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          transition: "opacity 0.4s ease",
          opacity: overlayVisible ? 1 : 0,
          pointerEvents: overlayVisible ? "auto" : "none",
        }}
      >
        {/* ── Card pack ─────────────────────────────────────────────────── */}
        {packVisible && (
          <div
            style={{
              position: "relative",
              width: 120,
              height: 180,
              animation: phase === "pack_present"
                ? "packSlideIn 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards"
                : undefined,
            }}
          >
            {/* Pack body — bottom half */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "50%",
                background: "linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 100%)",
                border: "2px solid rgba(245,215,110,0.4)",
                borderRadius: "0 0 10px 10px",
                animation: phase === "pack_shaking"
                  ? "packShake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) both"
                  : phase === "pack_opening"
                  ? "packBotOut 0.3s ease-in forwards"
                  : undefined,
              }}
            />
            {/* Pack body — top half */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "50%",
                background: "linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 100%)",
                border: "2px solid rgba(245,215,110,0.4)",
                borderRadius: "10px 10px 0 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                animation: phase === "pack_shaking"
                  ? "packShake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) both"
                  : phase === "pack_opening"
                  ? "packTopOut 0.3s ease-in forwards"
                  : undefined,
              }}
            >
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 900, letterSpacing: "0.2em", color: "rgba(245,215,110,0.85)" }}>
                MODVAULT
              </div>
              <div style={{ width: 32, height: 1, background: "rgba(245,215,110,0.4)" }} />
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>
                PIXEL CARD
              </div>
            </div>
            {/* Tear line */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: -4,
                right: -4,
                height: 2,
                background: "rgba(245,215,110,0.6)",
                transform: "translateY(-50%)",
              }}
            />
          </div>
        )}

        {/* ── Card reveal ───────────────────────────────────────────────── */}
        {cardVisible && (
          <div style={{ position: "relative" }}>
            {/* Gold particle burst */}
            {particlesActive &&
              PARTICLES.map((p, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: p.size,
                    height: p.size,
                    borderRadius: "50%",
                    background: "#f5d76e",
                    pointerEvents: "none",
                    // @ts-expect-error CSS custom properties
                    "--tx": String(p.tx),
                    "--ty": String(p.ty),
                    animation: `particleBurst 0.9s ${p.delay}s cubic-bezier(0,0,0.2,1) forwards`,
                  }}
                />
              ))}

            {/* The card itself */}
            <div
              className={phase === "card_flying" ? "cr-card-fly" : phase === "card_flipping" ? "cr-card-flip" : ""}
              style={{
                animation:
                  phase === "card_flying"
                    ? "cardFlyIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards"
                    : phase === "card_flipping"
                    ? "cardFlip360 0.8s cubic-bezier(0.4,0,0.2,1) forwards"
                    : undefined,
              }}
            >
              <TradingCard
                {...card}
                carLabel={carLabel}
                idle={phase === "card_settled" || phase === "show_continue"}
                interactive={false}
              />
            </div>
          </div>
        )}

        {/* ── Tap to continue ───────────────────────────────────────────── */}
        {continueVisible && (
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.22em",
              textTransform: "uppercase" as const,
              animation: "tapIn 0.4s ease-out forwards",
              marginTop: 8,
            }}
          >
            TAP TO CONTINUE
          </div>
        )}
      </div>
    </>
  );
}
