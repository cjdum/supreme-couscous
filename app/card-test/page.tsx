"use client";

import { TradingCard } from "@/components/garage/trading-card";

/**
 * Temporary test page — renders the TradingCard component with mock data
 * so we can verify the design brief implementation visually.
 * DELETE THIS FILE after card design is approved.
 */
export default function CardTestPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--bg-felt, #0f1a0f)",
        display: "flex",
        flexWrap: "wrap",
        gap: 40,
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
      }}
    >
      {/* Living card — Dawn era, Purist archetype */}
      <TradingCard
        cardUrl="https://placehold.co/512x512/0a0a0a/FFD700?text=PIXEL+ART"
        nickname="GOLDEN FURY"
        generatedAt="2025-03-15T12:00:00Z"
        cardNumber={98}
        era="Dawn"
        rarity="Rare"
        archetype="Purist"
        power={450}
        build={720}
        rep={34}
        isAlive={true}
        flavorText="Born in the garage. Raised on the track."
        carLabel="2024 Toyota Supra MK5"
        scale={1}
        idle
        interactive
      />

      {/* Ghost card — Turbo era, Aggressor */}
      <TradingCard
        cardUrl="https://placehold.co/512x512/0a0a0a/DC2626?text=TURBO"
        nickname="RED MENACE"
        generatedAt="2024-11-01T08:00:00Z"
        cardNumber={42}
        era="Turbo"
        rarity="Ultra Rare"
        archetype="Aggressor"
        power={680}
        build={900}
        rep={87}
        isAlive={false}
        carLabel="1999 Nissan Skyline GT-R"
        scale={1}
        idle
        interactive
      />

      {/* Dead/burned card */}
      <TradingCard
        cardUrl="https://placehold.co/512x512/0a0a0a/FF4444?text=BURNED"
        nickname="LAST RIDE"
        generatedAt="2024-06-01T00:00:00Z"
        cardNumber={7}
        era="Chrome"
        rarity="Common"
        power={200}
        build={150}
        rep={5}
        carLabel="2002 Honda Civic Si"
        scale={1}
        idle
        interactive
        dead
      />

      {/* Legendary card — Apex era */}
      <TradingCard
        cardUrl="https://placehold.co/512x512/0a0a0a/F59E0B?text=APEX"
        nickname="THUNDERGOD"
        generatedAt="2025-01-20T16:00:00Z"
        cardNumber={1}
        era="Apex"
        rarity="Legendary"
        archetype="Showboat"
        power={1200}
        build={950}
        rep={200}
        isAlive={true}
        carLabel="2025 Porsche 911 GT3 RS"
        scale={1}
        idle
        interactive
      />

      {/* Small scale card — like community grid */}
      <div>
        <p style={{ color: "var(--text-dim)", fontSize: 10, textAlign: "center", marginBottom: 8 }}>
          COMMUNITY GRID SIZE (0.7x)
        </p>
        <TradingCard
          cardUrl="https://placehold.co/512x512/0a0a0a/10B981?text=SLEEPER"
          nickname="QUIET STORM"
          generatedAt={null}
          cardNumber={256}
          era="Neon"
          rarity="Uncommon"
          archetype="Sleeper"
          power={380}
          build={600}
          rep={22}
          isAlive={true}
          carLabel="2020 Volkswagen Golf R"
          scale={0.7}
          idle={false}
          interactive={false}
        />
      </div>
    </div>
  );
}
