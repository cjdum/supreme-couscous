"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";

interface FeedCard {
  id: string;
  user_id: string;
  pixel_card_url: string;
  occasion: string | null;
  minted_at: string;
  username: string | null;
  car_snapshot: { year: number; make: string; model: string };
}

export default function CommunityPage() {
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feed?tab=new");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load feed");
        if (cancelled) return;
        const rows = (json.cards ?? []) as FeedCard[];
        setCards(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-64px)]">
        <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black tracking-tight mb-2">Community</h1>
      <p className="text-xs text-[var(--color-text-muted)] mb-8">
        Fresh cards from the feed.
      </p>

      {error && (
        <p className="text-xs text-[var(--color-danger)] mb-6" role="alert">
          {error}
        </p>
      )}

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Nothing here yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card) => (
            <FeedItem key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Feed card item ────────────────────────────────────────────────────
function FeedItem({ card }: { card: FeedCard }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    if (!card.pixel_card_url) return;
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
      const fallback = new window.Image();
      fallback.src = card.pixel_card_url;
      fallback.onload = () => draw(fallback);
    };
  }, [card.pixel_card_url]);

  async function handleLike() {
    if (liked || liking) return;
    setLiking(true);
    try {
      // Submit all-5s rating as a simple "like" reaction
      const res = await fetch("/api/ratings/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: card.id,
          cleanliness: 5,
          creativity: 5,
          execution: 5,
          presence: 5,
        }),
      });
      if (res.ok) {
        setLiked(true);
      }
    } catch {
      // silent — optimistic like
    } finally {
      setLiking(false);
    }
  }

  const CARD_W = 220;
  const CARD_H = Math.round(CARD_W * 1.4);
  const carLabel = `${card.car_snapshot.year} ${card.car_snapshot.make} ${card.car_snapshot.model}`;

  return (
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 flex flex-col items-center gap-3">
      <div style={{ filter: "drop-shadow(0 10px 24px rgba(59,130,246,0.18))" }}>
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          style={{
            width: CARD_W,
            height: CARD_H,
            borderRadius: 12,
            imageRendering: "pixelated",
            display: "block",
          }}
          aria-label={`Card for ${carLabel}`}
        />
      </div>

      <div className="w-full text-center">
        <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
          {carLabel}
        </p>
        {card.username && (
          <Link
            href={`/u/${card.username}`}
            className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            @{card.username}
          </Link>
        )}
        {card.occasion && (
          <p className="text-xs text-[var(--color-text-muted)] mt-2 line-clamp-2 italic">
            &ldquo;{card.occasion}&rdquo;
          </p>
        )}
      </div>

      <button
        onClick={handleLike}
        disabled={liked || liking}
        className="mt-1 flex items-center gap-2 h-9 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:cursor-default"
        style={{
          borderColor: liked ? "rgba(255,69,58,0.45)" : "var(--color-border)",
          background: liked ? "rgba(255,69,58,0.08)" : "transparent",
          color: liked ? "#ff8a65" : "var(--color-text-secondary)",
        }}
        aria-label={liked ? "Liked" : "Like"}
      >
        <Heart size={13} aria-hidden="true" fill={liked ? "currentColor" : "none"} />
        {liked ? "Liked" : "Like"}
      </button>
    </div>
  );
}
