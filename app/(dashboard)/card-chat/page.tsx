"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowUpRight, Send, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PixelCardSnapshot } from "@/lib/supabase/types";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_TURNS = 10;

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LiveCard {
  id: string;
  card_title: string | null;
  nickname: string;
  pixel_card_url: string;
  build_archetype: string | null;
  car_snapshot: PixelCardSnapshot;
  occasion: string | null;
  minted_at: string;
  personality?: string | null;
}

// ── Personality label ────────────────────────────────────────────────────────

const ARCHETYPE_TO_PERSONALITY: Record<string, string> = {
  "Track Weapon":    "The Veteran",
  "Show Stopper":    "The Diva",
  "Sleeper":         "The Conspiracy Theorist",
  "Street Brawler":  "The Veteran",
  "Daily Driven":    "The Anxious One",
  "Restomod":        "The Philosopher",
  "Stance Build":    "The Hypebeast",
  "Time Attack":     "The Stoic",
  "Cruiser":         "The Philosopher",
  "Drift Build":     "The Hypebeast",
  "Grand Tourer":    "The Diva",
  "Rally Build":     "The Veteran",
  "Show & Go":       "The Hypebeast",
  "Hypermiler":      "The Anxious One",
};

function resolvePersonality(card: LiveCard): string {
  if (card.personality) return card.personality;
  return ARCHETYPE_TO_PERSONALITY[card.build_archetype ?? ""] ?? "The Stoic";
}

// ── Empty / loading states ───────────────────────────────────────────────────

function NoCardState() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: "#05050c" }}>
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(107,70,193,0.15)",
          border: "1.5px solid rgba(168,85,247,0.35)",
        }}
      >
        <span style={{ fontSize: 24, color: "rgba(168,85,247,0.55)", fontFamily: "ui-monospace, monospace" }}>?</span>
      </div>
      <div>
        <p className="text-[13px] font-bold uppercase" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.1em", color: "rgba(220,200,255,0.85)" }}>
          No card to talk to
        </p>
        <p className="text-[11px] mt-1 max-w-[240px] mx-auto" style={{ fontFamily: "ui-monospace, monospace", color: "rgba(160,140,200,0.5)", lineHeight: 1.55 }}>
          You need a minted card before you can have a conversation with it.
        </p>
      </div>
      <Link
        href="/mint"
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl"
        style={{
          background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
          color: "white",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          boxShadow: "0 4px 20px rgba(123,79,212,0.4)",
        }}
      >
        Mint a card
        <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: "#05050c" }}>
      <div className="w-10 h-10 rounded-full" style={{ background: "rgba(168,85,247,0.2)", animation: "pulse 1.5s ease-in-out infinite" }} />
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function CardChatPage() {
  const [card, setCard] = useState<LiveCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [noCard, setNoCard] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [openingPending, setOpeningPending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Turn = one user→card exchange. Cap at MAX_TURNS.
  const turnsUsed = messages.filter((m) => m.role === "user").length;
  const sessionEnded = turnsUsed >= MAX_TURNS;

  // ── Fetch latest card ──────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        setNoCard(true);
        return;
      }
      const { data } = await supabase
        .from("pixel_cards")
        .select("id, card_title, nickname, pixel_card_url, build_archetype, car_snapshot, occasion, minted_at")
        .eq("user_id", user.id)
        .order("minted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        setLoading(false);
        setNoCard(true);
        return;
      }
      setCard(data as LiveCard);
      setLoading(false);
    });
  }, []);

  // ── Opening line ───────────────────────────────────────────────────────────
  const fetchOpeningLine = useCallback(async (cardId: string) => {
    setOpeningPending(true);
    setMessages([{ role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/card-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, history: [] }),
      });
      if (!res.ok || !res.body) {
        setMessages([{ role: "assistant", content: "…" }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages([{ role: "assistant", content: fullText }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: "…" }]);
    } finally {
      setOpeningPending(false);
    }
  }, []);

  useEffect(() => {
    if (card) fetchOpeningLine(card.id);
  }, [card, fetchOpeningLine]);

  // ── Send a message ─────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    if (!text.trim() || streaming || openingPending || !card || sessionEnded) return;

    const cleanHistory: Message[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const userMsg: Message = { role: "user", content: text.trim() };
    const nextMessages = [...cleanHistory, userMsg];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/card-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          message: text.trim(),
          history: cleanHistory.slice(-16),
        }),
      });
      if (!res.ok || !res.body) {
        setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: "…" }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: fullText }]);
      }
    } catch {
      setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: "…" }]);
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function resetSession() {
    if (card) fetchOpeningLine(card.id);
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) return <LoadingState />;
  if (noCard || !card) return <NoCardState />;

  const personality = resolvePersonality(card);
  const { year, make, model } = card.car_snapshot;
  const displayName = card.card_title || card.nickname;
  const isThinking = streaming || openingPending;
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const bubbleText = lastAssistantMsg?.content ?? "";

  return (
    <div
      className="min-h-dvh flex flex-col relative overflow-hidden"
      style={{ background: "#05050c", color: "#f4f0ff" }}
    >
      {/* ── Ambient glow ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 80% 55% at 50% 30%, rgba(168,85,247,0.28) 0%, transparent 60%)",
            "radial-gradient(ellipse 60% 40% at 30% 80%, rgba(91,33,182,0.18) 0%, transparent 60%)",
          ].join(", "),
        }}
      />

      {/* ── Top strip: turn counter + reset ── */}
      <header
        className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3"
        style={{ flexShrink: 0 }}
      >
        <div>
          <p
            className="text-[10px] font-bold uppercase"
            style={{
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.18em",
              color: "rgba(200,180,240,0.55)",
            }}
          >
            {personality}
          </p>
          <p
            className="text-[9px] mt-0.5"
            style={{
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.12em",
              color: "rgba(148,120,190,0.45)",
            }}
          >
            {year} {make} {model}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Turn counter */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: MAX_TURNS }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i < turnsUsed ? "rgba(168,85,247,0.9)" : "rgba(168,85,247,0.15)",
                  boxShadow: i < turnsUsed ? "0 0 6px rgba(168,85,247,0.6)" : "none",
                  transition: "background 300ms",
                }}
              />
            ))}
          </div>

          {sessionEnded && (
            <button
              type="button"
              onClick={resetSession}
              aria-label="Start a new session"
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg"
              style={{
                background: "rgba(168,85,247,0.15)",
                border: "1px solid rgba(168,85,247,0.35)",
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                fontWeight: 700,
                color: "#e9d5ff",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <RotateCcw size={11} />
              New
            </button>
          )}
        </div>
      </header>

      {/* ── Stage: speech bubble + card ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pb-4">
        {/* Speech bubble (above card) */}
        <div
          className="relative mb-5 max-w-md w-full"
          style={{ minHeight: 90 }}
        >
          <div
            style={{
              background: "rgba(15,12,30,0.75)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1.5px solid rgba(168,85,247,0.4)",
              borderRadius: 18,
              padding: "16px 20px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 0 24px rgba(168,85,247,0.2)",
              animation: "bubbleFade 320ms ease both",
              position: "relative",
            }}
          >
            {isThinking && !bubbleText ? (
              <div className="flex items-center gap-1.5 h-6">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "rgba(192,132,252,0.85)",
                      animation: `dotPulse 1.2s ease-in-out ${i * 0.18}s infinite`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "rgba(240,230,255,0.96)",
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  whiteSpace: "pre-wrap",
                  minHeight: 24,
                }}
              >
                {bubbleText}
              </p>
            )}

            {/* Tail pointing down to card */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: -9,
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width: 16,
                height: 16,
                background: "rgba(15,12,30,0.75)",
                borderRight: "1.5px solid rgba(168,85,247,0.4)",
                borderBottom: "1.5px solid rgba(168,85,247,0.4)",
              }}
            />
          </div>
        </div>

        {/* Card image — center, big, wiggles when speaking */}
        <div
          className="relative"
          style={{
            width: 220,
            height: 308,
            animation: isThinking ? "cardWiggle 0.9s ease-in-out infinite" : "cardFloat 4s ease-in-out infinite",
          }}
        >
          <div
            aria-hidden
            className="absolute -inset-8 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, rgba(168,85,247,0.45) 0%, transparent 65%)",
              filter: "blur(30px)",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.pixel_card_url}
            alt={displayName}
            className="relative w-full h-full object-cover"
            style={{
              borderRadius: 14,
              border: "2px solid rgba(245,215,110,0.55)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 32px rgba(168,85,247,0.35)",
              imageRendering: "pixelated",
            }}
          />
        </div>

        {/* Card name under the image */}
        <p
          className="mt-4 text-[11px] font-bold uppercase"
          style={{
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.18em",
            color: "rgba(220,200,255,0.75)",
          }}
        >
          {displayName}
        </p>

        {/* Last user message receipt */}
        {lastUserMsg && (
          <p
            className="mt-2 text-[10px] italic max-w-[280px] text-center"
            style={{
              fontFamily: "ui-monospace, monospace",
              color: "rgba(168,85,247,0.55)",
              letterSpacing: "0.04em",
            }}
          >
            you: &ldquo;{lastUserMsg.content}&rdquo;
          </p>
        )}
      </main>

      {/* ── Input bar ── */}
      <footer
        className="relative z-10 px-5"
        style={{
          flexShrink: 0,
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
          paddingTop: 12,
        }}
      >
        {sessionEnded ? (
          <div className="max-w-md mx-auto text-center">
            <p
              className="text-[11px] font-bold uppercase mb-3"
              style={{
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.14em",
                color: "rgba(200,180,240,0.55)",
              }}
            >
              Session ended · {MAX_TURNS} turns
            </p>
            <button
              type="button"
              onClick={resetSession}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl"
              style={{
                background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                color: "white",
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                boxShadow: "0 6px 24px rgba(123,79,212,0.45)",
              }}
            >
              <RotateCcw size={13} />
              Start new session
            </button>
          </div>
        ) : (
          <div
            className="max-w-md mx-auto flex items-center gap-2"
            style={{
              background: "rgba(15,12,30,0.72)",
              border: "1.5px solid rgba(168,85,247,0.3)",
              borderRadius: 16,
              padding: "6px 6px 6px 16px",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isThinking}
              aria-label="Message"
              placeholder={isThinking ? "thinking…" : "say something…"}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "rgba(230,215,255,0.95)",
                fontSize: 14,
                padding: "8px 0",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                opacity: isThinking ? 0.4 : 1,
              }}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isThinking}
              aria-label="Send"
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background:
                  input.trim() && !isThinking
                    ? "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)"
                    : "rgba(168,85,247,0.1)",
                border:
                  input.trim() && !isThinking
                    ? "1px solid rgba(123,79,212,0.5)"
                    : "1px solid rgba(168,85,247,0.15)",
                opacity: !input.trim() || isThinking ? 0.5 : 1,
                cursor: input.trim() && !isThinking ? "pointer" : "default",
                transition: "opacity 150ms, background 150ms",
                boxShadow:
                  input.trim() && !isThinking
                    ? "0 2px 14px rgba(123,79,212,0.4)"
                    : "none",
              }}
            >
              <Send size={14} style={{ color: input.trim() && !isThinking ? "white" : "rgba(168,85,247,0.5)" }} />
            </button>
          </div>
        )}
      </footer>

      <style jsx global>{`
        @keyframes bubbleFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes cardFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(-0.5deg); }
        }
        @keyframes cardWiggle {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          15% { transform: translate(-1.5px, -1px) rotate(-0.8deg); }
          35% { transform: translate(2px, 1px) rotate(0.6deg); }
          55% { transform: translate(-1px, -2px) rotate(-0.4deg); }
          75% { transform: translate(1.5px, 0) rotate(0.5deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
