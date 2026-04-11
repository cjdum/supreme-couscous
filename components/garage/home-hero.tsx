"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  MessageSquare,
  Wrench,
  DollarSign,
  Gauge,
  Zap,
  Send,
  Loader2,
  Calendar,
  TrendingUp,
  Car as CarIcon,
  ArrowRight,
  Flame,
} from "lucide-react";
import { TradingCard } from "./trading-card";
import { CardViewerModal } from "./card-viewer-modal";
import { safeEra, ERA_COLORS } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

// ── Types ─────────────────────────────────────────────────────────────────────

type FullCard = MintedCard & {
  card_title?: string | null;
  personality?: string | null;
  card_level?: number | null;
  build_archetype?: string | null;
  status?: string | null;
};

interface HomeHeroProps {
  card: MintedCard;
  carLabel: string;
  carMake: string;
  carModel: string;
  carYear: number;
  username: string;
  totalCards: number;
  installedModCount: number;
  wishlistCount: number;
  totalInvested: number;
  wishlistCost: number;
  biggestModName: string | null;
  biggestModCost: number | null;
  latestModName: string | null;
  daysSinceMint: number | null;
}

interface ChatMessage {
  role: "user" | "card";
  content: string;
}

// ── Main HomeHero ─────────────────────────────────────────────────────────────

export function HomeHero({
  card,
  carLabel,
  carMake,
  carModel,
  carYear,
  username,
  totalCards,
  installedModCount,
  wishlistCount,
  totalInvested,
  wishlistCost,
  biggestModName,
  biggestModCost,
  latestModName,
  daysSinceMint,
}: HomeHeroProps) {
  const detail = card as FullCard;
  const cardTitle = detail.card_title ?? detail.nickname;
  const snap = detail.car_snapshot;
  const personality = detail.personality;
  const era = safeEra(card.era);
  const eraStyle = ERA_COLORS[era];

  // ── Modal / chat state ──────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Speech bubble state ─────────────────────────────────────────────────────
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const [pokeLoading, setPokeLoading] = useState(false);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wiggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spontaneousTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show a bubble for ~10s, with wiggle during the first ~1.6s (the "speaking" phase).
  const showBubble = useCallback((text: string, duration = 10_000) => {
    if (!text.trim()) return;
    setBubble(text.trim());
    setBubbleVisible(true);
    setWiggle(true);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    if (wiggleTimerRef.current) clearTimeout(wiggleTimerRef.current);
    wiggleTimerRef.current = setTimeout(() => setWiggle(false), 1600);
    bubbleTimerRef.current = setTimeout(() => setBubbleVisible(false), duration);
  }, []);

  // Fetch a fresh line from the card-poke API. Instant — no Claude call.
  const fetchLine = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/card-poke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.id }),
      });
      if (!res.ok) {
        let errMsg = `Error ${res.status}`;
        try {
          const j = await res.json();
          errMsg = j.error ?? errMsg;
        } catch { /* ignore */ }
        setChatError(errMsg);
        return null;
      }
      const json = await res.json();
      if (!json.line?.trim()) {
        setChatError("Your card went quiet. Try again.");
        return null;
      }
      return json.line.trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setChatError(msg);
      return null;
    }
  }, [card.id]);

  // Manual poke — always fires, bypasses any throttling.
  const poke = useCallback(async () => {
    if (pokeLoading) return;
    setPokeLoading(true);
    setChatError(null);
    const line = await fetchLine();
    setPokeLoading(false);
    if (line) showBubble(line);
  }, [fetchLine, showBubble, pokeLoading]);

  // Initial opening line — runs once on mount after a short delay.
  useEffect(() => {
    const t = setTimeout(async () => {
      const line = await fetchLine();
      if (line) showBubble(line);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  // Spontaneous bubbles every 45–90 seconds while page is visible and chat closed.
  useEffect(() => {
    let cancelled = false;
    function schedule() {
      if (spontaneousTimerRef.current) clearTimeout(spontaneousTimerRef.current);
      const delay = 45_000 + Math.random() * 45_000; // 45–90s
      spontaneousTimerRef.current = setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === "visible" && !chatOpen) {
          const line = await fetchLine();
          if (line && !cancelled) showBubble(line);
        }
        schedule();
      }, delay);
    }
    schedule();
    return () => {
      cancelled = true;
      if (spontaneousTimerRef.current) clearTimeout(spontaneousTimerRef.current);
    };
  }, [fetchLine, showBubble, chatOpen]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      if (wiggleTimerRef.current) clearTimeout(wiggleTimerRef.current);
      if (spontaneousTimerRef.current) clearTimeout(spontaneousTimerRef.current);
    };
  }, []);

  // Auto-scroll chat when messages update
  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatOpen, messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [chatOpen]);

  // ── Send a message to the card ──────────────────────────────────────────────
  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput("");
    setChatError(null);

    const historyForApi = messages.map((m) => ({
      role: (m.role === "card" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages([...nextMessages, { role: "card", content: "" }]);
    setStreaming(true);
    setWiggle(true);

    try {
      const res = await fetch("/api/card-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, message: userMsg, history: historyForApi }),
      });
      if (!res.ok || !res.body) {
        let errMsg = `Error ${res.status}`;
        try {
          const text = await res.text();
          try {
            const j = JSON.parse(text);
            errMsg = j.error ?? text ?? errMsg;
          } catch {
            if (text) errMsg = text;
          }
        } catch {
          /* ignore */
        }
        setChatError(errMsg);
        setMessages(nextMessages);
        setStreaming(false);
        setWiggle(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "card", content: full }]);
      }
      if (full.trim()) {
        showBubble(full, 12_000);
      } else {
        setChatError("Your card went quiet.");
        setMessages(nextMessages);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setChatError(msg);
      setMessages(nextMessages);
    } finally {
      setStreaming(false);
      setTimeout(() => setWiggle(false), 1200);
    }
  }

  function handleCardClick() {
    setModalOpen(true);
  }

  function openChat() {
    setChatError(null);
    setChatOpen(true);
    // Seed with the current bubble if we have one and the drawer is empty.
    if (messages.length === 0 && bubble) {
      setMessages([{ role: "card", content: bubble }]);
    }
  }

  function closeChat() {
    setChatOpen(false);
  }

  // ── Stats panel data ────────────────────────────────────────────────────────
  const mintDate = (() => {
    try {
      return new Date(detail.minted_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  })();

  return (
    <div className="relative z-10 min-h-dvh flex flex-col">
      <style>{`
        @keyframes bubblePop {
          0% { opacity: 0; transform: translateY(-4px) scale(0.96); }
          60% { opacity: 1; transform: translateY(0) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes alivePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(48,209,88,0.5); }
          50% { opacity: 0.75; box-shadow: 0 0 0 7px rgba(48,209,88,0); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .hh-stagger > * { animation: fadeUp 500ms cubic-bezier(0.16,1,0.3,1) both; }
        .hh-stagger > *:nth-child(1) { animation-delay: 80ms; }
        .hh-stagger > *:nth-child(2) { animation-delay: 140ms; }
        .hh-stagger > *:nth-child(3) { animation-delay: 200ms; }
        .hh-stagger > *:nth-child(4) { animation-delay: 260ms; }
        @media (prefers-reduced-motion: reduce) {
          .hh-stagger > * { animation: none; }
        }
      `}</style>

      <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-10 px-5 pt-8 lg:pt-16 pb-8 max-w-6xl mx-auto w-full">
        {/* ── LEFT: Big card with speech bubble ── */}
        <section
          className="relative flex flex-col items-center"
          style={{ animation: "fadeUp 500ms cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Top welcome strip */}
          <p
            className="mb-4 text-[10px] font-bold uppercase text-center"
            style={{
              fontFamily: "'m6x11', monospace",
              letterSpacing: "0.22em",
              color: "rgba(200,180,240,0.5)",
            }}
          >
            {username}&apos;s vault · {totalCards} {totalCards === 1 ? "card" : "cards"}
          </p>

          {/* Speech bubble — hovering above the card */}
          <div
            aria-live="polite"
            style={{
              position: "relative",
              width: "min(360px, 92vw)",
              minHeight: 72,
              marginBottom: 14,
              pointerEvents: bubbleVisible ? "auto" : "none",
              opacity: bubbleVisible ? 1 : 0,
              transform: bubbleVisible ? "translateY(0)" : "translateY(-6px)",
              transition: "opacity 320ms ease, transform 320ms ease",
            }}
          >
            {bubble && (
              <div
                style={{
                  position: "relative",
                  background: "linear-gradient(158deg, rgba(20,14,38,0.95) 0%, rgba(14,10,28,0.95) 100%)",
                  border: "1.5px solid rgba(168,85,247,0.5)",
                  borderRadius: 18,
                  padding: "14px 18px 16px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.55), 0 0 26px rgba(168,85,247,0.22), inset 0 1px 0 rgba(255,255,255,0.08)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  animation: bubbleVisible ? "bubblePop 380ms cubic-bezier(0.34,1.56,0.64,1)" : "none",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "#f3ebff",
                    fontStyle: "italic",
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  }}
                >
                  {bubble}
                </p>
                {personality && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 8,
                      fontFamily: "'m6x11', monospace",
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: eraStyle.text,
                      opacity: 0.75,
                    }}
                  >
                    — {personality}
                  </p>
                )}
              </div>
            )}
            {bubble && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  bottom: -8,
                  left: "50%",
                  transform: "translateX(-50%) rotate(45deg)",
                  width: 14,
                  height: 14,
                  background: "rgba(16,10,30,0.95)",
                  borderRight: "1.5px solid rgba(168,85,247,0.5)",
                  borderBottom: "1.5px solid rgba(168,85,247,0.5)",
                }}
              />
            )}
          </div>

          {/* Chat error banner — visible whenever a fetch fails */}
          {chatError && (
            <div
              role="alert"
              style={{
                marginBottom: 12,
                padding: "8px 14px",
                borderRadius: 10,
                background: "rgba(220,38,38,0.14)",
                border: "1px solid rgba(220,38,38,0.4)",
                color: "#fca5a5",
                fontSize: 11,
                fontFamily: "'m6x11', monospace",
                letterSpacing: "0.02em",
                maxWidth: 360,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              {chatError}
            </div>
          )}

          {/* The card — click to open modal */}
          <div style={{ position: "relative" }}>
            <button
              onClick={handleCardClick}
              aria-label={`Open ${cardTitle} card`}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                margin: 0,
                cursor: "pointer",
                display: "block",
              }}
            >
              <TradingCard
                cardUrl={card.pixel_card_url}
                nickname={card.nickname}
                generatedAt={card.minted_at}
                hp={card.hp}
                modCount={card.mod_count}
                buildScore={snap.build_score}
                vinVerified={snap.vin_verified}
                cardNumber={card.card_number}
                era={card.era}
                rarity={card.rarity}
                flavorText={card.flavor_text}
                occasion={card.occasion}
                mods={snap.mods ?? []}
                modsDetail={snap.mods_detail}
                torque={snap.torque ?? null}
                zeroToSixty={snap.zero_to_sixty ?? null}
                totalInvested={snap.total_invested ?? null}
                personality={personality}
                cardLevel={detail.card_level}
                carLabel={carLabel}
                scale={1.15}
                idle={!wiggle}
                wiggle={wiggle}
                interactive
              />
            </button>

            {/* Alive badge */}
            <div
              style={{
                position: "absolute",
                bottom: -14,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 14px",
                borderRadius: 999,
                background: "rgba(20,14,38,0.92)",
                border: "1px solid rgba(48,209,88,0.4)",
                boxShadow: "0 6px 20px rgba(0,0,0,0.5), 0 0 16px rgba(48,209,88,0.22)",
                backdropFilter: "blur(10px)",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#30d158",
                  animation: "alivePulse 2.2s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#30d158",
                  fontFamily: "'m6x11', monospace",
                }}
              >
                Alive
              </span>
            </div>
          </div>

          {/* CTA row — poke + talk */}
          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <button
              type="button"
              onClick={poke}
              disabled={pokeLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 38,
                padding: "0 14px",
                borderRadius: 11,
                background: "rgba(168,85,247,0.12)",
                border: "1px solid rgba(168,85,247,0.32)",
                color: "#e9d5ff",
                fontFamily: "'m6x11', monospace",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: pokeLoading ? "wait" : "pointer",
                opacity: pokeLoading ? 0.6 : 1,
                transition: "background 150ms ease, border-color 150ms ease, opacity 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (pokeLoading) return;
                e.currentTarget.style.background = "rgba(168,85,247,0.2)";
                e.currentTarget.style.borderColor = "rgba(168,85,247,0.52)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(168,85,247,0.12)";
                e.currentTarget.style.borderColor = "rgba(168,85,247,0.32)";
              }}
            >
              {pokeLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {pokeLoading ? "Poking…" : "Poke"}
            </button>
            <button
              type="button"
              onClick={chatOpen ? closeChat : openChat}
              aria-pressed={chatOpen}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 38,
                padding: "0 18px",
                borderRadius: 11,
                background: chatOpen
                  ? "rgba(168,85,247,0.3)"
                  : "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                border: chatOpen ? "1px solid rgba(168,85,247,0.6)" : "1px solid rgba(168,85,247,0.5)",
                color: "white",
                fontFamily: "'m6x11', monospace",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 4px 18px rgba(123,79,212,0.42)",
                transition: "transform 150ms ease, box-shadow 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(123,79,212,0.55)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 18px rgba(123,79,212,0.42)";
              }}
            >
              <MessageSquare size={13} />
              {chatOpen ? "Close" : "Talk to it"}
            </button>
          </div>
        </section>

        {/* ── RIGHT: Info panels ── */}
        <aside
          className="w-full lg:w-[420px] flex flex-col gap-3 hh-stagger"
          style={{ maxWidth: "min(460px, 96vw)" }}
        >
          {/* Card identity panel */}
          <div
            style={{
              background: "linear-gradient(158deg, rgba(20,14,38,0.85) 0%, rgba(14,10,28,0.65) 100%)",
              border: "1px solid rgba(168,85,247,0.25)",
              borderRadius: 18,
              padding: "18px 20px",
              backdropFilter: "blur(14px)",
              boxShadow: "0 14px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: "'m6x11', monospace",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: eraStyle.text,
                }}
              >
                Your living card
              </p>
              {daysSinceMint != null && (
                <p
                  style={{
                    margin: 0,
                    fontFamily: "'m6x11', monospace",
                    fontSize: 9,
                    color: "rgba(200,180,240,0.5)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {daysSinceMint === 0 ? "Today" : daysSinceMint === 1 ? "1 day old" : `${daysSinceMint} days old`}
                </p>
              )}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 900,
                lineHeight: 1.1,
                color: "#f3eaff",
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}
            >
              {cardTitle}
            </h1>

            {/* Badge row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
              {personality && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: "rgba(168,85,247,0.18)",
                    border: "1px solid rgba(168,85,247,0.42)",
                    color: "#e9d5ff",
                    letterSpacing: "0.1em",
                    fontFamily: "'m6x11', monospace",
                    textTransform: "uppercase",
                  }}
                >
                  {personality}
                </span>
              )}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: eraStyle.bg,
                  border: `1px solid ${eraStyle.border}`,
                  color: eraStyle.text,
                  letterSpacing: "0.1em",
                  fontFamily: "'m6x11', monospace",
                  textTransform: "uppercase",
                }}
              >
                {era}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "rgba(48,209,88,0.1)",
                  border: "1px solid rgba(48,209,88,0.32)",
                  color: "#30d158",
                  letterSpacing: "0.1em",
                  fontFamily: "'m6x11', monospace",
                  textTransform: "uppercase",
                }}
              >
                {card.rarity ?? "Common"}
              </span>
            </div>

            {/* Stats grid — 4 big tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              <StatTile
                icon={<Zap size={11} />}
                label="HP"
                value={card.hp != null ? String(card.hp) : "—"}
                tint="#ff7b54"
              />
              <StatTile
                icon={<Wrench size={11} />}
                label="Mods"
                value={card.mod_count != null ? String(card.mod_count) : "—"}
                tint="#60a5fa"
              />
              <StatTile
                icon={<DollarSign size={11} />}
                label="Spent"
                value={
                  totalInvested > 0
                    ? "$" + (totalInvested >= 1000 ? (totalInvested / 1000).toFixed(1) + "k" : String(totalInvested))
                    : "—"
                }
                tint="#30d158"
              />
              <StatTile
                icon={<Gauge size={11} />}
                label="Score"
                value={snap.build_score != null ? String(snap.build_score) : "—"}
                tint="#c084fc"
              />
            </div>

            {/* Flavor text — italic quote */}
            {card.flavor_text && (
              <p
                style={{
                  margin: "14px 0 0",
                  fontSize: 12,
                  fontStyle: "italic",
                  lineHeight: 1.55,
                  color: "rgba(220,205,255,0.75)",
                  padding: "10px 14px",
                  borderRadius: 11,
                  background: "rgba(123,79,212,0.08)",
                  border: "1px solid rgba(123,79,212,0.2)",
                }}
              >
                &ldquo;{card.flavor_text}&rdquo;
              </p>
            )}
          </div>

          {/* Build info panel */}
          <div
            style={{
              background: "linear-gradient(158deg, rgba(18,12,34,0.75) 0%, rgba(12,8,24,0.55) 100%)",
              border: "1px solid rgba(168,85,247,0.2)",
              borderRadius: 18,
              padding: "16px 18px",
              backdropFilter: "blur(14px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <CarIcon size={12} style={{ color: "rgba(200,180,240,0.55)" }} />
              <p
                style={{
                  margin: 0,
                  fontFamily: "'m6x11', monospace",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "rgba(200,180,240,0.55)",
                }}
              >
                The build
              </p>
            </div>

            <p
              style={{
                margin: "0 0 12px",
                fontSize: 14,
                fontWeight: 700,
                color: "#f0eaff",
                letterSpacing: "-0.01em",
              }}
            >
              {carYear} {carMake} {carModel}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <InfoLine label="Biggest mod" value={biggestModName} extra={biggestModCost != null ? `$${biggestModCost.toLocaleString()}` : null} />
              <InfoLine label="Latest add" value={latestModName} icon={<TrendingUp size={9} />} />
              <InfoLine label="Installed" value={String(installedModCount)} icon={<Wrench size={9} />} />
              <InfoLine label="Wishlist" value={`${wishlistCount}${wishlistCost > 0 ? ` · $${(wishlistCost / 1000).toFixed(1)}k` : ""}`} icon={<Sparkles size={9} />} />
            </div>
          </div>

          {/* Footer strip — mint date + quick links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 16px",
              borderRadius: 14,
              background: "rgba(14,10,28,0.55)",
              border: "1px solid rgba(168,85,247,0.15)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Calendar size={11} style={{ color: "rgba(200,180,240,0.5)", flexShrink: 0 }} />
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontFamily: "'m6x11', monospace",
                color: "rgba(200,180,240,0.6)",
                letterSpacing: "0.08em",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Born {mintDate ?? "—"}
            </p>
            <Link
              href="/mint"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                borderRadius: 8,
                background: "rgba(220,38,38,0.1)",
                border: "1px solid rgba(220,38,38,0.28)",
                color: "#f87171",
                fontFamily: "'m6x11', monospace",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                textDecoration: "none",
                flexShrink: 0,
              }}
              title="Burn & remint"
            >
              <Flame size={9} /> Remint
            </Link>
          </div>

          {/* Quick actions row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <QuickLink href="/garage" label="Garage" icon={<CarIcon size={12} />} />
            <QuickLink href="/community" label="Community" icon={<ArrowRight size={12} />} />
          </div>
        </aside>
      </div>

      {/* ── Chat drawer — slides up from the bottom when open ── */}
      {chatOpen && (
        <div
          role="dialog"
          aria-label="Chat with your card"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 60,
            display: "flex",
            justifyContent: "center",
            padding: "0 12px 12px",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              width: "100%",
              maxWidth: 560,
              background: "linear-gradient(180deg, rgba(20,14,38,0.97) 0%, rgba(12,8,22,0.98) 100%)",
              border: "1.5px solid rgba(168,85,247,0.45)",
              borderRadius: 18,
              boxShadow: "0 -24px 80px rgba(0,0,0,0.65), 0 0 40px rgba(168,85,247,0.2)",
              backdropFilter: "blur(18px)",
              padding: "14px 14px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              animation: "fadeUp 280ms cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px" }}>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#f0e8ff",
                    letterSpacing: "0.04em",
                  }}
                >
                  {cardTitle}
                </p>
                <p
                  style={{
                    margin: "1px 0 0",
                    fontSize: 9,
                    fontFamily: "'m6x11', monospace",
                    color: eraStyle.text,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    opacity: 0.7,
                  }}
                >
                  {personality ?? "Your card"}
                </p>
              </div>
              <button
                onClick={closeChat}
                aria-label="Close chat"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(230,215,255,0.7)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  lineHeight: 1,
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>

            {/* Messages list */}
            {messages.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 280,
                  overflowY: "auto",
                  padding: "6px 4px 4px",
                }}
              >
                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "85%",
                        padding: m.role === "user" ? "8px 13px" : "10px 14px",
                        borderRadius:
                          m.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                        background:
                          m.role === "user"
                            ? "rgba(168,85,247,0.22)"
                            : "rgba(14,10,28,0.75)",
                        border:
                          m.role === "user"
                            ? "1px solid rgba(168,85,247,0.38)"
                            : "1px solid rgba(168,85,247,0.2)",
                        fontSize: m.role === "card" ? 13 : 12,
                        lineHeight: 1.55,
                        color: m.role === "user" ? "rgba(230,215,255,0.9)" : "#ede8ff",
                        fontStyle: m.role === "card" ? "italic" : "normal",
                      }}
                    >
                      {m.content ||
                        (streaming && i === messages.length - 1 ? (
                          <span style={{ display: "inline-flex", gap: 3 }}>
                            {[0, 1, 2].map((d) => (
                              <span
                                key={d}
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: "rgba(168,85,247,0.6)",
                                  display: "inline-block",
                                  animation: `dotBounce 1s ease-in-out ${d * 0.2}s infinite`,
                                }}
                              />
                            ))}
                          </span>
                        ) : (
                          "…"
                        ))}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Chat error */}
            {chatError && (
              <div
                role="alert"
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(220,38,38,0.1)",
                  border: "1px solid rgba(220,38,38,0.35)",
                  color: "#fca5a5",
                  fontSize: 11,
                  fontFamily: "'m6x11', monospace",
                  letterSpacing: "0.02em",
                }}
              >
                {chatError}
              </div>
            )}

            {/* Input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 4px 4px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(168,85,247,0.28)",
                borderRadius: 13,
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Say something to ${cardTitle}…`}
                disabled={streaming}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#f0e8ff",
                  fontSize: 14,
                  padding: "10px 0",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                aria-label="Send"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  background:
                    input.trim() && !streaming
                      ? "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)"
                      : "rgba(168,85,247,0.15)",
                  border:
                    input.trim() && !streaming
                      ? "1px solid rgba(123,79,212,0.5)"
                      : "1px solid rgba(168,85,247,0.18)",
                  color: input.trim() && !streaming ? "white" : "rgba(168,85,247,0.5)",
                  cursor: input.trim() && !streaming ? "pointer" : "default",
                  opacity: !input.trim() || streaming ? 0.55 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "opacity 140ms ease",
                }}
              >
                {streaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full card modal ── */}
      {modalOpen && (
        <CardViewerModal
          cards={[card]}
          carLabel={carLabel}
          startIndex={0}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "9px 10px",
        borderRadius: 11,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(168,85,247,0.15)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: tint,
          opacity: 0.7,
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "'m6x11', monospace",
          }}
        >
          {label}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 900,
          color: "rgba(245,238,255,0.98)",
          fontFamily: "'m6x11', monospace",
          letterSpacing: "-0.01em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function InfoLine({
  label,
  value,
  extra,
  icon,
}: {
  label: string;
  value: string | null;
  extra?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {icon && <span style={{ color: "rgba(200,180,240,0.4)" }}>{icon}</span>}
        <p
          style={{
            margin: 0,
            fontFamily: "'m6x11', monospace",
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(200,180,240,0.5)",
          }}
        >
          {label}
        </p>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 700,
          color: value ? "rgba(240,232,255,0.92)" : "rgba(200,180,240,0.35)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value ?? "—"}
        {extra && (
          <span
            style={{
              marginLeft: 6,
              fontSize: 10,
              color: "rgba(200,180,240,0.5)",
              fontFamily: "'m6x11', monospace",
            }}
          >
            {extra}
          </span>
        )}
      </p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 12,
        background: "rgba(15,12,30,0.55)",
        border: "1px solid rgba(168,85,247,0.18)",
        color: "rgba(230,215,255,0.85)",
        fontFamily: "'m6x11', monospace",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        textDecoration: "none",
        transition: "background 150ms ease, border-color 150ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(20,16,40,0.75)";
        e.currentTarget.style.borderColor = "rgba(168,85,247,0.38)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(15,12,30,0.55)";
        e.currentTarget.style.borderColor = "rgba(168,85,247,0.18)";
      }}
    >
      <span>{label}</span>
      {icon}
    </Link>
  );
}
