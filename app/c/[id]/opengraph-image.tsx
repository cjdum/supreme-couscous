import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { safeEra } from "@/lib/pixel-card";

export const runtime = "nodejs";
export const alt = "Pixel card on MODVAULT";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ERA_GLOW: Record<string, string> = {
  Dawn:   "rgba(245,166,35,0.4)",
  Chrome: "rgba(192,192,208,0.3)",
  Turbo:  "rgba(255,59,48,0.4)",
  Neon:   "rgba(0,255,136,0.35)",
  Apex:   "rgba(168,85,247,0.5)",
};

const ERA_TEXT: Record<string, string> = {
  Dawn:   "#f5a623",
  Chrome: "#d0d0e0",
  Turbo:  "#ff5c52",
  Neon:   "#00ff88",
  Apex:   "#c084fc",
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cardRaw } = await supabase
    .from("pixel_cards")
    .select("pixel_card_url, nickname, car_snapshot, era, card_number, hp, mod_count")
    .eq("id", id)
    .maybeSingle();

  // Fallback branded image if card missing
  if (!cardRaw) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #05050c 0%, #1a0b3d 50%, #05050c 100%)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 72,
            letterSpacing: "0.2em",
            fontWeight: 900,
          }}
        >
          MODVAULT
        </div>
      ),
      { ...size },
    );
  }

  const card = cardRaw as {
    pixel_card_url: string;
    nickname: string;
    car_snapshot: { year: number; make: string; model: string; total_invested: number | null };
    era: string | null;
    card_number: number | null;
    hp: number | null;
    mod_count: number | null;
  };

  const era = safeEra(card.era);
  const glow = ERA_GLOW[era] ?? "rgba(168,85,247,0.5)";
  const eraText = ERA_TEXT[era] ?? "#c084fc";
  const snap = card.car_snapshot;
  const carLabel = `${snap.year} ${snap.make} ${snap.model}`;
  const spent = snap.total_invested ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          background: "#05050c",
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 30% 50%, ${glow} 0%, transparent 60%),
            linear-gradient(135deg, #05050c 0%, #08061a 50%, #05050c 100%)
          `,
          position: "relative",
          fontFamily: "monospace",
        }}
      >
        {/* Pixel grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(168,85,247,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            display: "flex",
          }}
        />

        {/* Left: card image */}
        <div
          style={{
            flex: "0 0 auto",
            width: 460,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 50,
          }}
        >
          <div
            style={{
              width: 360,
              height: 360,
              borderRadius: 24,
              border: `3px solid ${eraText}`,
              boxShadow: `0 0 80px ${glow}, 0 30px 80px rgba(0,0,0,0.8)`,
              overflow: "hidden",
              display: "flex",
              background: "#0a0a18",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.pixel_card_url}
              alt="card"
              width={360}
              height={360}
              style={{ width: 360, height: 360, objectFit: "contain" }}
            />
          </div>
        </div>

        {/* Right: info */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "50px 60px 50px 0",
          }}
        >
          {/* Era pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(168,85,247,0.15)",
              border: `2px solid ${eraText}`,
              alignSelf: "flex-start",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: eraText,
                display: "flex",
              }}
            />
            <span
              style={{
                color: eraText,
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
              }}
            >
              {era} Era
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 900,
              color: "#fff",
              marginBottom: 10,
              letterSpacing: "-0.02em",
            }}
          >
            {carLabel}
          </div>
          {/* Nickname */}
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "#f5d76e",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 36,
            }}
          >
            {card.nickname}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
            <Stat label="HP" value={card.hp != null ? String(card.hp) : "—"} />
            <Stat label="MODS" value={card.mod_count != null ? String(card.mod_count) : "—"} />
            <Stat label="SPENT" value={spent > 0 ? `$${(spent / 1000).toFixed(1)}k` : "—"} />
            {card.card_number != null && (
              <Stat label="CARD #" value={String(card.card_number).padStart(4, "0")} />
            )}
          </div>

          {/* Brand row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: "auto" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(168,85,247,0.6)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                letterSpacing: "0.25em",
                color: "#fff",
                fontWeight: 900,
              }}
            >
              MODVAULT
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          fontSize: 14,
          fontWeight: 700,
          color: "rgba(200,180,240,0.55)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 40,
          fontWeight: 900,
          color: "#fff",
        }}
      >
        {value}
      </div>
    </div>
  );
}
