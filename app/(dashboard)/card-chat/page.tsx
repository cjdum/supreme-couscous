"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LiveCard {
  id: string;
  pixel_card_url: string;
  car_label: string;
  personality: string | null;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export default function CardChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardIdParam = searchParams.get("cardId");

  const [card, setCard] = useState<LiveCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [speech, setSpeech] = useState<string>("");
  const [speaking, setSpeaking] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const openingCalledRef = useRef(false);

  // ── Load the living card (by id or the one alive card) ──────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }

      let query = supabase
        .from("pixel_cards")
        .select("id, pixel_card_url, car_snapshot, personality, status")
        .eq("user_id", user.id);

      query = cardIdParam
        ? query.eq("id", cardIdParam)
        : query.eq("status", "alive");

      const { data } = await query.maybeSingle();
      if (!data) { router.push("/home"); return; }

      const row = data as {
        id: string;
        pixel_card_url: string;
        car_snapshot: { year: number; make: string; model: string };
        personality: string | null;
        status: string;
      };
      const snap = row.car_snapshot;
      setCard({
        id: row.id,
        pixel_card_url: row.pixel_card_url,
        car_label: `${snap.year} ${snap.make} ${snap.model}`,
        personality: row.personality,
      });
      setLoading(false);
    });
  }, [cardIdParam, router]);

  // ── Pixelate the card to canvas ─────────────────────────────────────
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
      const fallback = new window.Image();
      fallback.src = card.pixel_card_url;
      fallback.onload = () => draw(fallback);
    };
  }, [card?.pixel_card_url]);

  // ── Streaming send helper ────────────────────────────────────────────
  async function sendMessage(message: string, priorHistory: Turn[]) {
    if (!card) return;
    setSpeaking(true);
    setShaking(true);
    setSpeech("");
    setError(null);

    try {
      const res = await fetch("/api/card-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          message,
          history: priorHistory,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Chat failed");
      }
      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setSpeech(acc);
      }

      // Save turn to history (skip if this was the opening line)
      if (message) {
        setHistory((prev) => [
          ...prev,
          { role: "user", content: message },
          { role: "assistant", content: acc },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setSpeaking(false);
      // Let shake run a beat longer than stream for dramatic effect
      setTimeout(() => setShaking(false), 300);
    }
  }

  // ── Kick off opening line on first load ─────────────────────────────
  useEffect(() => {
    if (!card || openingCalledRef.current) return;
    openingCalledRef.current = true;
    sendMessage("", []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  // ── User submits a message ──────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || speaking) return;
    setInput("");
    await sendMessage(text, history);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-64px)]">
        <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (!card) return null;

  const CARD_W = 260;
  const CARD_H = Math.round(CARD_W * 1.4);

  return (
    <div className="px-5 sm:px-8 pt-6 pb-6 max-w-md mx-auto flex flex-col min-h-[calc(100dvh-64px)]">
      <style>{`
        @keyframes chat-shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          20%      { transform: translate(-2px, 1px) rotate(-0.5deg); }
          40%      { transform: translate(2px, -1px) rotate(0.5deg); }
          60%      { transform: translate(-1px, 2px) rotate(-0.3deg); }
          80%      { transform: translate(1px, -2px) rotate(0.3deg); }
        }
        @keyframes bubble-in {
          0%   { opacity: 0; transform: translateY(6px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .shake { animation: chat-shake 0.25s linear infinite; }
        .bubble-in { animation: bubble-in 0.22s ease-out; }
      `}</style>

      {/* Back link */}
      <Link
        href="/home"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-colors mb-6"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Home
      </Link>

      {/* Card + bubble */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <div style={{ position: "relative", width: CARD_W, height: CARD_H }}>
          <div
            className={shaking ? "shake" : ""}
            style={{ filter: "drop-shadow(0 20px 40px rgba(59,130,246,0.22))" }}
          >
            <canvas
              ref={canvasRef}
              width={CARD_W}
              height={CARD_H}
              style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: 14,
                imageRendering: "pixelated",
                display: "block",
              }}
              aria-label="Living card"
            />
          </div>

          {/* Speech bubble overlay */}
          {speech && (
            <div
              className="bubble-in"
              style={{
                position: "absolute",
                left: "50%",
                bottom: "-12px",
                transform: "translate(-50%, 100%)",
                minWidth: 220,
                maxWidth: 320,
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(20,20,22,0.95)",
                border: "1.5px solid rgba(59,130,246,0.35)",
                boxShadow: "0 12px 36px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
                color: "#f5f5f7",
                fontSize: 14,
                lineHeight: 1.45,
                fontStyle: "italic",
                textAlign: "left",
              }}
            >
              {/* Bubble tail */}
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -8,
                  left: "50%",
                  width: 14,
                  height: 14,
                  transform: "translateX(-50%) rotate(45deg)",
                  background: "rgba(20,20,22,0.95)",
                  borderLeft: "1.5px solid rgba(59,130,246,0.35)",
                  borderTop: "1.5px solid rgba(59,130,246,0.35)",
                }}
              />
              &ldquo;{speech}&rdquo;
              {speaking && (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 14,
                    marginLeft: 4,
                    verticalAlign: "text-bottom",
                    background: "#60A5FA",
                    animation: "pulse 1s ease-in-out infinite",
                  }}
                />
              )}
            </div>
          )}
        </div>

        <p
          style={{
            marginTop: speech ? 80 : 20,
            fontFamily: "ui-monospace,monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {card.personality ?? "Your card"} · {card.car_label}
        </p>
      </div>

      {error && (
        <p className="text-xs text-[var(--color-danger)] text-center mt-3" role="alert">
          {error}
        </p>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-6 flex items-end gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={speaking ? "Wait, it's talking…" : "Say something…"}
          disabled={speaking}
          maxLength={300}
          className="flex-1 h-11 px-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={speaking || !input.trim()}
          className="h-11 w-11 rounded-xl bg-[var(--color-accent)] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 cursor-pointer transition-all"
          aria-label="Send"
        >
          <Send size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
