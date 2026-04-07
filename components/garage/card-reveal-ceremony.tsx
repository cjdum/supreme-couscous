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
  | "nickname_reveal"
  | "show_continue";
const DISMISSING_PHASES = new Set<Phase>(["card_settled", "nickname_reveal", "show_continue"]);

// 12 gold particles fanning out in a sunburst
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
  const [displayedNickname, setDisplayedNickname] = useState("");
  const [particlesActive, setParticlesActive] = useState(false);

  // ── Advance through phases ─────────────────────────────────────────────
  useEffect(() => {
    const q = (delay: number, next: Phase) =>
      setTimeout(() => setPhase(next), delay);

    const t1 = q(50,   "dimming");
    const t2 = q(350,  "pack_present");
    const t3 = q(1100, "pack_shaking");
    const t4 = q(1900, "pack_opening");
    const t5 = q(2450, "card_flying");
    const t6 = q(2900, "card_flipping");
    const t7 = q(3700, "card_settled");
    const t8 = q(3800, "nickname_reveal");
    const t9 = q(5200, "show_continue");

    // Trigger particle burst when card flips
    const tp = setTimeout(() => setParticlesActive(true), 3700);
    const tp2 = setTimeout(() => setParticlesActive(false), 5000);

    return () => {
      [t1, t2, t3, t4, t5, t6, t7, t8, t9, tp, tp2].forEach(clearTimeout);
    };
  }, []);

  // ── Typewriter for nickname ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "nickname_reveal") return;
    let i = 0;
    setDisplayedNickname("");
    const iv = setInterval(() => {
      i++;
      if (i <= card.nickname.length) {
        setDisplayedNickname(card.nickname.slice(0, i));
      } else {
        clearInterval(iv);
      }
    }, 65);
    return () => clearInterval(iv);
  }, [phase, card.nickname]);

  function handleDismiss() {
    if (!DISMISSING_PHASES.has(phase)) return;
    setTimeout(onComplete, 300);
  }

  // ── Derive visual state from phase ────────────────────────────────────
  const overlayVisible = phase !== "hidden";
  const packVisible    = phase === "pack_present" || phase === "pack_shaking" || phase === "pack_opening";
  const cardVisible    = ["card_flying", "card_flipping", "card_settled", "nickname_reveal", "show_continue"].includes(phase);
  const nickVisible    = ["nickname_reveal", "show_continue"].includes(phase);
  const continueVisible = phase === "show_continue";

  return (
    <>
      <style>{`
        @keyframes packShake {
          0%,100% { transform: translateX(0); }
          15%      { transform: translateX(-8px) rotate(-2deg); }
          35%      { transform: translateX(8px)  rotate(2deg); }
          55%      { transform: translateX(-6px) rotate(-1.5deg); }
          75%      { transform: translateX(6px)  rotate(1.5deg); }
        }
        @keyframes packTopOut {
          from { transform: translateY(0); opacity: 1; }
          to   { transform: translateY(-160px); opacity: 0; }
        }
        @keyframes packBotOut {
          from { transform: translateY(0); opacity: 1; }
          to   { transform: translateY(160px); opacity: 0; }
        }
        @keyframes cardFlyIn {
          from { transform: scale(0.06) translateY(60px); opacity: 0; }
          60%  { transform: scale(1.07) translateY(-8px); opacity: 1; }
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
        @keyframes nicknameIn {
          from { opacity: 0; letter-spacing: 0.6em; }
          to   { opacity: 1; letter-spacing: 0.2em; }
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
          background: "rgba(4,4,12,0.96)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          transition: "opacity 0.5s ease",
          opacity: overlayVisible ? 1 : 0,
          pointerEvents: overlayVisible ? "auto" : "none",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* ── Card pack ─────────────────────────────────────────────────── */}
        {packVisible && (
          <div style={{ position: "relative", width: 120, height: 180 }}>
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
                  ? "packShake 0.8s cubic-bezier(0.36,0.07,0.19,0.97) both"
                  : phase === "pack_opening"
                  ? "packBotOut 0.45s ease-in forwards"
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
                  ? "packShake 0.8s cubic-bezier(0.36,0.07,0.19,0.97) both"
                  : phase === "pack_opening"
                  ? "packTopOut 0.45s ease-in forwards"
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
              style={{
                animation:
                  phase === "card_flying"
                    ? "cardFlyIn 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards"
                    : phase === "card_flipping"
                    ? "cardFlip360 0.8s cubic-bezier(0.4,0,0.2,1) forwards"
                    : undefined,
              }}
            >
              <TradingCard
                {...card}
                carLabel={carLabel}
                idle={phase === "card_settled" || phase === "nickname_reveal" || phase === "show_continue"}
                interactive={false}
              />
            </div>
          </div>
        )}

        {/* ── Nickname typewriter ───────────────────────────────────────── */}
        {nickVisible && (
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 22,
              fontWeight: 900,
              color: "#f5d76e",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              animation: "nicknameIn 0.6s ease-out forwards",
              textShadow: "0 0 20px rgba(245,215,110,0.5)",
            }}
          >
            {displayedNickname}
            <span style={{ opacity: displayedNickname.length < card.nickname.length ? 1 : 0, borderRight: "2px solid #f5d76e", marginLeft: 2 }} />
          </div>
        )}

        {/* ── Tap to continue ───────────────────────────────────────────── */}
        {continueVisible && (
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.2em",
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
