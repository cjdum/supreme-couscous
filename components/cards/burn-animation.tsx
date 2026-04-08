"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BurnAnimationProps {
  cardImageUrl: string;
  cardLabel: string;
  lastWords: string;
  personality: string;
  onComplete: () => void;
}

type Phase = "last-words" | "burning" | "ash" | "done";

// ── Typewriter hook ────────────────────────────────────────────────────────────

function useTypewriter(text: string, active: boolean, speed = 38): string {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      indexRef.current = 0;
      return;
    }
    indexRef.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, active, speed]);

  return displayed;
}

// ── Fire particle config ───────────────────────────────────────────────────────

interface Particle {
  id: number;
  left: number;       // percent 0–100
  size: number;       // px 4–12
  delay: number;      // ms
  duration: number;   // ms
  color: string;
  driftX: number;     // px –30 to 30
}

const PARTICLE_COLORS = ["#ff4500", "#ff6a00", "#ff8c00", "#ffb300", "#ff3d00", "#ff6600"];

function buildParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 5 + Math.random() * 90,
    size: 4 + Math.random() * 8,
    delay: Math.random() * 800,
    duration: 900 + Math.random() * 700,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    driftX: (Math.random() - 0.5) * 60,
  }));
}

// Use a stable set — generated once outside the component so it never
// changes between renders and never causes layout thrash.
const PARTICLES = buildParticles(14);

// ── Component ─────────────────────────────────────────────────────────────────

export function BurnAnimation({
  cardImageUrl,
  cardLabel,
  lastWords,
  personality,
  onComplete,
}: BurnAnimationProps) {
  const [phase, setPhase] = useState<Phase>("last-words");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const typedText = useTypewriter(lastWords, phase === "last-words", 36);

  useEffect(() => {
    // Phase "last-words" ends at 3 s → transition to "burning"
    const t1 = setTimeout(() => setPhase("burning"), 3000);
    // Phase "burning" ends at 5 s → transition to "ash"
    const t2 = setTimeout(() => setPhase("ash"), 5000);
    // Phase "ash" ends at 6 s → done
    const t3 = setTimeout(() => {
      setPhase("done");
      onCompleteRef.current();
    }, 6200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (phase === "done") return null;

  const isBurning = phase === "burning";
  const isAsh = phase === "ash";

  return (
    <>
      {/* ── Keyframes ── */}
      <style>{`
        @keyframes burnRise {
          from {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          to {
            transform: translateY(-120px) scale(0.2) rotate(15deg);
            opacity: 0;
          }
        }

        @keyframes burnSweep {
          from { clip-path: inset(100% 0 0 0); }
          to   { clip-path: inset(0 0 0 0); }
        }

        @keyframes ashFade {
          0%   { opacity: 1;  filter: grayscale(0) brightness(1); }
          40%  { opacity: 0.7; filter: grayscale(1) brightness(0.6); }
          100% { opacity: 0;  filter: grayscale(1) brightness(0.3); }
        }

        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes cardEntrance {
          from { opacity: 0; transform: translateY(24px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes textReveal {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes emberFloat {
          0%   { opacity: 0; transform: translateY(0) scale(0); }
          15%  { opacity: 1; }
          85%  { opacity: 0.4; }
          100% { opacity: 0; transform: translateY(-180px) scale(0.1) rotate(20deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .burn-card-wrap,
          .burn-overlay-sweep,
          .burn-particle,
          .burn-ash-overlay {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* ── Full-screen overlay ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${cardLabel} — final words`}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0,0,0,0.95)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          animation: "overlayFadeIn 300ms ease forwards",
        }}
      >
        {/* Card + fire container */}
        <div
          className="burn-card-wrap"
          style={{
            position: "relative",
            width: 300,
            animation: isAsh
              ? "ashFade 1200ms ease forwards"
              : "cardEntrance 400ms ease forwards",
            filter: isAsh ? undefined : "none",
          }}
        >
          {/* Card image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardImageUrl}
            alt={cardLabel}
            width={300}
            height={420}
            style={{
              display: "block",
              width: 300,
              height: 420,
              objectFit: "cover",
              borderRadius: 16,
              boxShadow: isBurning || isAsh
                ? "0 0 60px rgba(255,80,0,0.55), 0 0 120px rgba(255,50,0,0.25)"
                : "0 8px 48px rgba(0,0,0,0.7)",
              transition: "box-shadow 600ms ease",
            }}
          />

          {/* Burn sweep — dark scorch overlay that sweeps from bottom to top */}
          {isBurning && (
            <div
              className="burn-overlay-sweep"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 16,
                background:
                  "linear-gradient(to top, rgba(20,8,2,0.92) 0%, rgba(60,20,5,0.75) 40%, rgba(120,40,0,0.35) 70%, transparent 100%)",
                animation: "burnSweep 2000ms ease forwards",
                animationDelay: "100ms",
              }}
            />
          )}

          {/* Particles — rendered during burning phase */}
          {isBurning &&
            PARTICLES.map((p) => (
              <div
                key={p.id}
                className="burn-particle"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  bottom: "2%",
                  left: `${p.left}%`,
                  width: p.size,
                  height: p.size,
                  borderRadius: "50%",
                  background: p.color,
                  boxShadow: `0 0 ${p.size * 1.5}px ${p.color}`,
                  animation: `burnRise ${p.duration}ms ease-out ${p.delay}ms infinite`,
                  transform: `translateX(${p.driftX}px)`,
                  pointerEvents: "none",
                }}
              />
            ))}

          {/* Ash overlay — gray dust settling */}
          {isAsh && (
            <div
              className="burn-ash-overlay"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 16,
                background:
                  "radial-gradient(ellipse at 50% 80%, rgba(80,70,60,0.6) 0%, rgba(30,25,20,0.85) 70%)",
              }}
            />
          )}

          {/* Last words pill — shown only during last-words phase */}
          {phase === "last-words" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 20px",
                borderRadius: 16,
                background: "rgba(0,0,0,0.55)",
                animation: "textReveal 300ms ease forwards",
              }}
            >
              {/* Personality chip */}
              <div
                style={{
                  marginBottom: 16,
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: "rgba(255,100,0,0.18)",
                  border: "1px solid rgba(255,100,0,0.38)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#ffb300",
                }}
              >
                {personality}
              </div>

              {/* Last words */}
              <p
                style={{
                  margin: 0,
                  fontSize: "clamp(15px, 3vw, 20px)",
                  fontStyle: "italic",
                  fontWeight: 600,
                  color: "#fdf6e3",
                  textAlign: "center",
                  lineHeight: 1.55,
                  textShadow: "0 1px 8px rgba(0,0,0,0.9)",
                  letterSpacing: "0.01em",
                  minHeight: "3em",
                }}
              >
                &ldquo;{typedText}
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: "1.1em",
                    background: "#ffb300",
                    marginLeft: 2,
                    verticalAlign: "middle",
                    animation: "overlayFadeIn 600ms step-end infinite",
                  }}
                />
                &rdquo;
              </p>

              {/* Car label */}
              <p
                style={{
                  margin: "18px 0 0",
                  fontSize: 11,
                  color: "rgba(253,246,227,0.45)",
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {cardLabel}
              </p>
            </div>
          )}
        </div>

        {/* Phase label below card */}
        <div
          style={{
            marginTop: 28,
            height: 20,
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: isBurning
              ? "rgba(255,140,0,0.7)"
              : isAsh
              ? "rgba(180,160,140,0.5)"
              : "rgba(253,246,227,0.35)",
            transition: "color 600ms ease",
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {phase === "last-words" && "Final transmission"}
          {phase === "burning" && "Burning..."}
          {phase === "ash" && "Gone"}
        </div>
      </div>
    </>
  );
}
