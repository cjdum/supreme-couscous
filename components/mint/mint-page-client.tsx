"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { MintStudio } from "./mint-studio";
import { BurnAnimation } from "@/components/cards/burn-animation";
import type { MintableCar, AliveCardInfo } from "./mint-studio";

interface MintPageClientProps {
  cars: MintableCar[];
  aliveCard: AliveCardInfo | null;
  karma: number;
  karmaThreshold: number;
}

type BurnPhase = "idle" | "fetching_plea" | "showing_plea" | "fetching_words" | "animating" | "done";

export function MintPageClient({ cars, aliveCard }: MintPageClientProps) {
  const [burnPhase, setBurnPhase] = useState<BurnPhase>("idle");
  const [plea, setPlea] = useState<string | null>(null);
  const [lastWords, setLastWords] = useState<string | null>(null);
  const [burnError, setBurnError] = useState<string | null>(null);
  const [burned, setBurned] = useState(false);
  // Track which car was burned so we auto-mint the same car after
  const [burnedCarId, setBurnedCarId] = useState<string | null>(null);

  // Step 1: Fetch the card's plea
  async function handleInitiateBurn() {
    if (!aliveCard) return;
    // Remember the car so we can auto-mint it after the burn
    setBurnedCarId(aliveCard.carId);
    setBurnPhase("fetching_plea");
    setBurnError(null);

    try {
      const res = await fetch("/api/cards/plea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: aliveCard.id }),
      });
      const json = await res.json();
      setPlea(json.plea ?? "Please... I have so much more to give.");
      setBurnPhase("showing_plea");
    } catch {
      // Plea fetch failed — still show plea screen with fallback
      setPlea("Please... don't do this to me.");
      setBurnPhase("showing_plea");
    }
  }

  // Step 2: User confirmed burn despite plea — fetch last words
  async function handleConfirmBurn() {
    if (!aliveCard) return;
    setBurnPhase("fetching_words");

    try {
      const res = await fetch("/api/cards/burn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: aliveCard.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBurnError(json.error ?? "Burn failed");
        setBurnPhase("idle");
        return;
      }
      setLastWords(json.last_words ?? "So long.");
      setBurnPhase("animating");
    } catch {
      setBurnError("Something went wrong. Try again.");
      setBurnPhase("idle");
    }
  }

  function handleBurnComplete() {
    setBurnPhase("done");
    setBurned(true);
  }

  // ── Fetching plea loading screen ──────────────────────────────────────────
  if (burnPhase === "fetching_plea") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(6,6,17,0.97)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          border: "3px solid rgba(168,85,247,0.25)",
          borderTopColor: "#a855f7",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{
          color: "rgba(220,200,255,0.7)", fontSize: 13,
          fontFamily: "ui-monospace, monospace", letterSpacing: "0.06em",
        }}>
          {aliveCard?.cardTitle ?? aliveCard?.nickname ?? "Your card"} wants to say something...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Plea screen — the card pleads for its life ────────────────────────────
  if (burnPhase === "showing_plea" && aliveCard) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#060611",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Background ambient */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(220,38,38,0.05) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "70%", height: "40%",
          background: "radial-gradient(ellipse at 50% 100%, rgba(168,85,247,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 32,
          padding: "40px 28px", maxWidth: 460, width: "100%",
        }}>
          {/* Card — shivering with life */}
          <div style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={aliveCard.pixelCardUrl}
              alt={aliveCard.cardTitle ?? aliveCard.nickname}
              style={{
                width: 168, height: 236, objectFit: "cover",
                borderRadius: 14,
                boxShadow: "0 0 0 1px rgba(168,85,247,0.35), 0 8px 48px rgba(123,79,212,0.3)",
                animation: "cardShiver 0.25s ease-in-out infinite alternate",
              }}
            />
            {/* Alive pulse dot */}
            <div style={{
              position: "absolute", top: 10, right: 10,
              width: 9, height: 9, borderRadius: "50%",
              background: "#30d158",
              boxShadow: "0 0 0 3px rgba(48,209,88,0.2)",
              animation: "alivePulse 1.5s ease-in-out infinite",
            }} />
          </div>

          {/* Plea */}
          <div style={{ textAlign: "center" }}>
            {aliveCard.personality && (
              <p style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.16em", textTransform: "uppercase",
                color: "rgba(168,85,247,0.65)",
                marginBottom: 14,
                fontFamily: "ui-monospace, monospace",
              }}>
                {aliveCard.personality}
              </p>
            )}
            <p style={{
              fontSize: "clamp(16px, 4vw, 20px)",
              fontWeight: 600, lineHeight: 1.6,
              color: "#f0e8ff", fontStyle: "italic",
              maxWidth: 380,
            }}>
              &ldquo;{plea}&rdquo;
            </p>
          </div>

          {/* Decision buttons */}
          <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 340 }}>
            <button
              onClick={() => setBurnPhase("idle")}
              style={{
                flex: 1, padding: "14px 0",
                borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: "rgba(168,85,247,0.12)",
                border: "1px solid rgba(168,85,247,0.4)",
                color: "#e9d5ff", cursor: "pointer",
                transition: "background 150ms ease",
              }}
              className="spare-btn"
            >
              Spare it
            </button>
            <button
              onClick={handleConfirmBurn}
              style={{
                flex: 1, padding: "14px 0",
                borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: "rgba(220,38,38,0.12)",
                border: "1px solid rgba(220,38,38,0.45)",
                color: "#f87171", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                transition: "background 150ms ease",
              }}
              className="burn-anyway-btn"
            >
              <Flame size={14} /> Burn anyway
            </button>
          </div>

          <p style={{
            fontSize: 11, color: "rgba(200,180,240,0.3)",
            fontFamily: "ui-monospace, monospace", letterSpacing: "0.04em",
            textAlign: "center",
          }}>
            This action is permanent and cannot be undone.
          </p>
        </div>

        <style>{`
          @keyframes cardShiver {
            0% { transform: rotate(-0.6deg) scale(1); }
            100% { transform: rotate(0.6deg) scale(1.005); }
          }
          @keyframes alivePulse {
            0%, 100% { box-shadow: 0 0 0 3px rgba(48,209,88,0.2); }
            50% { box-shadow: 0 0 0 7px rgba(48,209,88,0.06); }
          }
          .spare-btn:hover { background: rgba(168,85,247,0.22) !important; }
          .burn-anyway-btn:hover { background: rgba(220,38,38,0.22) !important; box-shadow: 0 0 20px rgba(220,38,38,0.15); }
        `}</style>
      </div>
    );
  }

  // ── Fetching last words loading screen ────────────────────────────────────
  if (burnPhase === "fetching_words") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(6,6,17,0.97)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          border: "3px solid rgba(255,100,0,0.25)",
          borderTopColor: "#ff4500",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{
          color: "rgba(255,200,100,0.7)", fontSize: 13,
          fontFamily: "ui-monospace, monospace", letterSpacing: "0.06em",
        }}>
          Final words...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Burn animation ────────────────────────────────────────────────────────
  if (burnPhase === "animating" && aliveCard) {
    return (
      <BurnAnimation
        cardImageUrl={aliveCard.pixelCardUrl}
        cardLabel={aliveCard.carLabel}
        lastWords={lastWords ?? "It was a good run."}
        personality={aliveCard.personality ?? "The Veteran"}
        onComplete={handleBurnComplete}
      />
    );
  }

  // ── Normal mint page ──────────────────────────────────────────────────────
  return (
    <>
      {burnError && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 9998, padding: "10px 20px", borderRadius: 10,
          background: "rgba(255,69,58,0.12)", border: "1px solid rgba(255,69,58,0.45)",
          color: "#ff453a", fontSize: 12, fontWeight: 700,
          whiteSpace: "nowrap",
        }}>
          {burnError}
        </div>
      )}
      <MintStudio
        cars={cars}
        aliveCard={burned ? null : aliveCard}
        autoMintCarId={burned ? burnedCarId : null}
        onInitiateBurn={handleInitiateBurn}
      />
    </>
  );
}
