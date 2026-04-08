"use client";

import { useState } from "react";
import { MintStudio } from "./mint-studio";
import { BurnAnimation } from "@/components/cards/burn-animation";
import type { MintableCar, AliveCardInfo } from "./mint-studio";

interface MintPageClientProps {
  cars: MintableCar[];
  aliveCard: AliveCardInfo | null;
  karma: number;
  karmaThreshold: number;
}

type BurnPhase = "idle" | "fetching_words" | "animating" | "done";

export function MintPageClient({ cars, aliveCard, karma, karmaThreshold }: MintPageClientProps) {
  const [burnPhase, setBurnPhase] = useState<BurnPhase>("idle");
  const [lastWords, setLastWords] = useState<string | null>(null);
  const [burnError, setBurnError] = useState<string | null>(null);
  // After burn completes, treat aliveCard as gone
  const [burned, setBurned] = useState(false);

  async function handleInitiateBurn() {
    if (!aliveCard) return;
    setBurnPhase("fetching_words");
    setBurnError(null);

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

  // Show full-screen loading while fetching last words
  if (burnPhase === "fetching_words") {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(6,6,17,0.97)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "3px solid rgba(255,100,0,0.3)",
            borderTopColor: "#ff4500",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "rgba(255,200,100,0.8)", fontSize: 13, fontFamily: "ui-monospace, monospace", letterSpacing: "0.06em" }}>
          Asking for last words...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Show burn animation
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

  return (
    <>
      {burnError && (
        <div
          style={{
            position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
            zIndex: 9998, padding: "10px 20px", borderRadius: 10,
            background: "rgba(255,69,58,0.12)", border: "1px solid rgba(255,69,58,0.45)",
            color: "#ff453a", fontSize: 12, fontWeight: 700,
          }}
        >
          {burnError}
        </div>
      )}
      <MintStudio
        cars={cars}
        aliveCard={burned ? null : aliveCard}
        karma={karma}
        karmaThreshold={karmaThreshold}
        onInitiateBurn={handleInitiateBurn}
      />
    </>
  );
}
