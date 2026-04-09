"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TimelineCard {
  id: string;
  pixel_card_url: string | null;
  status: string;               // 'alive' | 'ghost'
  occasion: string | null;
  minted_at: string;
  burned_at: string | null;
  last_words: string | null;
  car_label: string;
}

export default function TimelinePage() {
  const router = useRouter();
  const [cards, setCards] = useState<TimelineCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("pixel_cards")
        .select("id, pixel_card_url, status, occasion, minted_at, burned_at, last_words, car_snapshot")
        .eq("user_id", user.id)
        .order("minted_at", { ascending: false });

      type Row = {
        id: string;
        pixel_card_url: string | null;
        status: string;
        occasion: string | null;
        minted_at: string;
        burned_at: string | null;
        last_words: string | null;
        car_snapshot: { year: number; make: string; model: string };
      };

      const rows = (data ?? []) as Row[];
      const list: TimelineCard[] = rows.map((r) => ({
        id: r.id,
        pixel_card_url: r.pixel_card_url,
        status: r.status,
        occasion: r.occasion,
        minted_at: r.minted_at,
        burned_at: r.burned_at,
        last_words: r.last_words,
        car_label: `${r.car_snapshot.year} ${r.car_snapshot.make} ${r.car_snapshot.model}`,
      }));

      // Sort so alive cards come first, then ghosts by minted_at desc
      list.sort((a, b) => {
        if (a.status === "alive" && b.status !== "alive") return -1;
        if (a.status !== "alive" && b.status === "alive") return 1;
        return new Date(b.minted_at).getTime() - new Date(a.minted_at).getTime();
      });

      setCards(list);
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-64px)]">
        <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black tracking-tight mb-2">Timeline</h1>
      <p className="text-xs text-[var(--color-text-muted)] mb-8">
        Every card you&rsquo;ve ever minted. Living and gone.
      </p>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <p className="text-sm text-[var(--color-text-secondary)]">No cards yet.</p>
          <Link
            href="/mint"
            className="text-sm font-bold text-[var(--color-accent)] hover:text-[var(--color-accent-bright)] transition-colors"
          >
            Mint your first card →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <TimelineItem key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Timeline card item (canvas-pixelated) ─────────────────────────────
function TimelineItem({ card }: { card: TimelineCard }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isAlive = card.status === "alive";

  useEffect(() => {
    if (!card.pixel_card_url) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = card.pixel_card_url;

    const draw = (source: HTMLImageElement) => {
      const aspect = source.naturalHeight / (source.naturalWidth || 1);
      const PX = 48;
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
      fallback.src = card.pixel_card_url!;
      fallback.onload = () => draw(fallback);
    };
  }, [card.pixel_card_url]);

  const CARD_W = 96;
  const CARD_H = Math.round(CARD_W * 1.4);

  const mintedStr = new Date(card.minted_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const burnedStr = card.burned_at
    ? new Date(card.burned_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const content = (
    <div
      className="relative flex gap-4 p-4 rounded-2xl border transition-all"
      style={{
        background: isAlive ? "rgba(59,130,246,0.05)" : "var(--color-bg-card)",
        borderColor: isAlive
          ? "rgba(59,130,246,0.4)"
          : "var(--color-border)",
      }}
    >
      {isAlive && (
        <span
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            fontFamily: "ui-monospace,monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#60A5FA",
            background: "rgba(59,130,246,0.12)",
            padding: "3px 8px",
            borderRadius: 6,
            border: "1px solid rgba(59,130,246,0.3)",
          }}
        >
          Current
        </span>
      )}

      {/* Card image */}
      <div
        style={{
          flexShrink: 0,
          filter: isAlive ? undefined : "grayscale(1) brightness(0.6)",
          opacity: isAlive ? 1 : 0.75,
        }}
      >
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          style={{
            width: CARD_W,
            height: CARD_H,
            borderRadius: 8,
            imageRendering: "pixelated",
            display: "block",
          }}
          aria-label={`Card for ${card.car_label}`}
        />
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
          {card.car_label}
        </p>
        {card.occasion && (
          <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
            {card.occasion}
          </p>
        )}

        <div className="mt-3 flex flex-col gap-0.5">
          <span
            style={{
              fontFamily: "ui-monospace,monospace",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            Minted {mintedStr}
          </span>
          {!isAlive && burnedStr && (
            <span
              style={{
                fontFamily: "ui-monospace,monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,138,101,0.55)",
              }}
            >
              Burned {burnedStr}
            </span>
          )}
        </div>

        {!isAlive && card.last_words && (
          <p
            className="mt-2 text-[11px] italic leading-snug"
            style={{ color: "rgba(255,138,101,0.75)" }}
          >
            &ldquo;{card.last_words}&rdquo;
          </p>
        )}
      </div>
    </div>
  );

  // Living card clicks to home where the live card hero lives
  return isAlive ? (
    <Link href="/home" className="block">
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  );
}
