"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface Card {
  id: string;
  pixel_card_url: string | null;
}

interface HomeCardHeroProps {
  card: Card | null;
  carLabel: string;
  cardId: string | null;
}

export function HomeCardHero({ card, carLabel, cardId }: HomeCardHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!card?.pixel_card_url) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = card.pixel_card_url;

    const draw = (source: HTMLImageElement) => {
      const aspect = source.naturalHeight / (source.naturalWidth || 1);
      const PX = 64;
      const PY = Math.round(PX * aspect);

      const tiny = document.createElement("canvas");
      tiny.width = PX;
      tiny.height = PY;
      const tctx = tiny.getContext("2d");
      if (!tctx) return;
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(source, 0, 0, PX, PY);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tiny, 0, 0, canvas.width, canvas.height);
    };

    img.onload = () => draw(img);
    img.onerror = () => {
      // Retry without crossOrigin for non-CORS hosts
      const fallback = new window.Image();
      fallback.src = card.pixel_card_url!;
      fallback.onload = () => draw(fallback);
    };
  }, [card?.pixel_card_url]);

  if (!card) {
    // No living card — empty outline + single CTA
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-5">
        <style>{`
          @keyframes pulse-border {
            0%, 100% { opacity: 0.25; }
            50% { opacity: 0.55; }
          }
        `}</style>
        <div
          style={{
            width: "min(300px, 90vw)",
            aspectRatio: "3/4.2",
            borderRadius: 18,
            border: "2px dashed rgba(59,130,246,0.4)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            background: "rgba(59,130,246,0.03)",
            animation: "pulse-border 2.5s ease-in-out infinite",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 14 14" fill="none" aria-hidden="true"
            style={{ color: "rgba(59,130,246,0.3)" }}>
            <path d="M2 9l2-5h6l2 5H2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <circle cx="4.5" cy="10" r="1" fill="currentColor" />
            <circle cx="9.5" cy="10" r="1" fill="currentColor" />
          </svg>
          <p style={{ fontFamily: "ui-monospace,monospace", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", margin: 0 }}>
            No card yet
          </p>
        </div>

        <p style={{
          marginTop: 20,
          fontFamily: "ui-monospace,monospace",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
        }}>
          {carLabel}
        </p>

        <Link
          href="/mint"
          style={{
            marginTop: 24,
            height: 48,
            padding: "0 28px",
            borderRadius: 12,
            background: "#3B82F6",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          Mint your first card
        </Link>
      </div>
    );
  }

  // Has living card — pixelated canvas hero with floating animation
  const CARD_W = 300;
  const CARD_H = Math.round(CARD_W * 1.4);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-5">
      <style>{`
        @keyframes card-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        .card-hero-float {
          animation: card-float 3.5s ease-in-out infinite;
        }
      `}</style>

      <div className="card-hero-float" style={{ filter: "drop-shadow(0 24px 48px rgba(59,130,246,0.22))" }}>
        {card.pixel_card_url ? (
          <canvas
            ref={canvasRef}
            width={CARD_W}
            height={CARD_H}
            style={{
              width: CARD_W,
              height: CARD_H,
              borderRadius: 16,
              imageRendering: "pixelated",
              display: "block",
            }}
            aria-label={`Pixel card for ${carLabel}`}
          />
        ) : (
          <div
            style={{
              width: CARD_W,
              height: CARD_H,
              borderRadius: 16,
              background: "linear-gradient(158deg, #111 0%, #1a1a1a 100%)",
              border: "1.5px solid rgba(59,130,246,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="64" height="64" viewBox="0 0 14 14" fill="none" aria-hidden="true"
              style={{ color: "rgba(59,130,246,0.25)" }}>
              <path d="M2 9l2-5h6l2 5H2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <circle cx="4.5" cy="10" r="1" fill="currentColor" />
              <circle cx="9.5" cy="10" r="1" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>

      <p style={{
        marginTop: 24,
        fontFamily: "ui-monospace,monospace",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.45)",
      }}>
        {carLabel}
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <Link
          href={cardId ? `/card-chat?cardId=${cardId}` : "/card-chat"}
          style={{
            height: 44,
            padding: "0 24px",
            borderRadius: 10,
            border: "1.5px solid rgba(59,130,246,0.35)",
            color: "#60A5FA",
            fontWeight: 700,
            fontSize: 13,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            background: "rgba(59,130,246,0.06)",
            letterSpacing: "0.02em",
          }}
        >
          Talk
        </Link>
        <Link
          href="/mint"
          style={{
            height: 44,
            padding: "0 24px",
            borderRadius: 10,
            background: "#3B82F6",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          Mint
        </Link>
      </div>
    </div>
  );
}
