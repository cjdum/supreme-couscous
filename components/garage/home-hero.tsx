"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  MessageSquare,
  Send,
  Loader2,
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
  previousCardFlavourText?: string | null;
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
  previousCardFlavourText,
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

  const poke = useCallback(async () => {
    if (pokeLoading) return;
    setPokeLoading(true);
    setChatError(null);
    const line = await fetchLine();
    setPokeLoading(false);
    if (line) showBubble(line);
  }, [fetchLine, showBubble, pokeLoading]);

  // Initial opening line
  useEffect(() => {
    const t = setTimeout(async () => {
      const line = await fetchLine();
      if (line) showBubble(line);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  // Spontaneous bubbles every 45–90s
  useEffect(() => {
    let cancelled = false;
    function schedule() {
      if (spontaneousTimerRef.current) clearTimeout(spontaneousTimerRef.current);
      const delay = 45_000 + Math.random() * 45_000;
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

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      if (wiggleTimerRef.current) clearTimeout(wiggleTimerRef.current);
      if (spontaneousTimerRef.current) clearTimeout(spontaneousTimerRef.current);
    };
  }, []);

  // Auto-scroll chat
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

  // ── Send a message ──────────────────────────────────────────────────────────
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
        } catch { /* ignore */ }
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

  function handleCardClick() { setModalOpen(true); }
  function openChat() {
    setChatError(null);
    setChatOpen(true);
    if (messages.length === 0 && bubble) {
      setMessages([{ role: "card", content: bubble }]);
    }
  }
  function closeChat() { setChatOpen(false); }

  // ── Computed ────────────────────────────────────────────────────────────────
  const mintDate = (() => {
    try {
      return new Date(detail.minted_at).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      });
    } catch { return null; }
  })();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative z-10 min-h-dvh">
      <style>{`
        @keyframes hhBubblePop {
          0%   { opacity: 0; transform: translateY(-4px) scale(0.96); }
          60%  { opacity: 1; transform: translateY(0) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hhFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hhDotBounce {
          0%, 80%, 100% { transform: translateY(0);   opacity: 0.5; }
          40%            { transform: translateY(-5px); opacity: 1;   }
        }
        .hh-layout {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: hhFadeUp 400ms cubic-bezier(0.16,1,0.3,1) both;
        }
        .hh-cols {
          display: flex;
          flex-direction: column;
          gap: 24px;
          align-items: flex-start;
        }
        @media (min-width: 680px) {
          .hh-cols { flex-direction: row; }
        }
        .hh-left {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
          width: 280px;
        }
        @media (max-width: 679px) {
          .hh-left { width: 100%; align-items: center; }
        }
        .hh-right {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        @media (prefers-reduced-motion: reduce) {
          .hh-layout { animation: none; }
        }
      `}</style>

      <div className="hh-layout">

        {/* ── Vault label ────────────────────────────────────────────── */}
        <p style={{
          textAlign: "center",
          margin: 0,
          fontSize: 10,
          color: "var(--text-dim)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}>
          {username}&apos;s vault · {totalCards} {totalCards === 1 ? "card" : "cards"}
        </p>

        {/* ── Last words panel ──────────────────────────────��─────────── */}
        {previousCardFlavourText && (
          <div style={{
            padding: "12px 16px",
            background: "var(--bg-raised)",
            borderLeft: "3px solid var(--era-dawn)",
            borderTop: "1px solid var(--border-card)",
            borderRight: "1px solid var(--border-card)",
            borderBottom: "1px solid var(--border-card)",
          }}>
            <p style={{ margin: 0, fontSize: 12, fontStyle: "italic", color: "var(--text-primary)", lineHeight: 1.55 }}>
              &ldquo;{previousCardFlavourText}&rdquo;
            </p>
            <p style={{ margin: "5px 0 0", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              — last words
            </p>
          </div>
        )}

        {/* ── Two columns ──────────────────────────────────────��──────── */}
        <div className="hh-cols">

          {/* LEFT: Card + bubble + CTA ─────────────────────────────── */}
          <section className="hh-left">

            {/* Speech bubble */}
            <div
              aria-live="polite"
              style={{
                width: "100%",
                minHeight: 58,
                marginBottom: 12,
                pointerEvents: bubbleVisible ? "auto" : "none",
                opacity: bubbleVisible ? 1 : 0,
                transform: bubbleVisible ? "translateY(0)" : "translateY(-6px)",
                transition: "opacity 280ms ease, transform 280ms ease",
              }}
            >
              {bubble && (
                <div style={{
                  position: "relative",
                  background: "var(--bg-raised)",
                  borderLeft: "3px solid var(--era-dawn)",
                  borderTop: "1px solid var(--border-card)",
                  borderRight: "1px solid var(--border-card)",
                  borderBottom: "1px solid var(--border-card)",
                  padding: "10px 14px 12px",
                  animation: bubbleVisible ? "hhBubblePop 320ms cubic-bezier(0.34,1.56,0.64,1)" : "none",
                }}>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "var(--text-primary)", fontStyle: "italic" }}>
                    {bubble}
                  </p>
                  {personality && (
                    <p style={{ margin: "5px 0 0", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      — {personality}
                    </p>
                  )}
                  {/* Caret */}
                  <div aria-hidden style={{
                    position: "absolute",
                    bottom: -7,
                    left: "50%",
                    transform: "translateX(-50%) rotate(45deg)",
                    width: 12,
                    height: 12,
                    background: "var(--bg-raised)",
                    borderRight: "1px solid var(--border-card)",
                    borderBottom: "1px solid var(--border-card)",
                  }} />
                </div>
              )}
            </div>

            {/* Chat error */}
            {chatError && (
              <div role="alert" style={{
                marginBottom: 10,
                padding: "6px 12px",
                background: "rgba(220,38,38,0.1)",
                border: "1px solid rgba(220,38,38,0.4)",
                color: "var(--text-danger)",
                fontSize: 10,
                letterSpacing: "0.04em",
                width: "100%",
              }}>
                {chatError}
              </div>
            )}

            {/* Card */}
            <button
              onClick={handleCardClick}
              aria-label={`Open ${cardTitle} card`}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block" }}
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
                idle={!wiggle}
                wiggle={wiggle}
                interactive
              />
            </button>

            {/* POKE + TALK buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, width: "100%" }}>
              <button
                type="button"
                className="mv-btn mv-btn-ghost"
                onClick={poke}
                disabled={pokeLoading}
                style={{ flex: 1, opacity: pokeLoading ? 0.6 : 1, cursor: pokeLoading ? "wait" : "pointer" }}
              >
                {pokeLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {pokeLoading ? "Poking..." : "Poke"}
              </button>
              <button
                type="button"
                className="mv-btn mv-btn-primary"
                onClick={chatOpen ? closeChat : openChat}
                aria-pressed={chatOpen}
                style={{ flex: 1 }}
              >
                <MessageSquare size={11} />
                {chatOpen ? "Close" : "Talk to it"}
              </button>
            </div>
          </section>

          {/* RIGHT: Info panel ──────────────────────────────────────── */}
          <aside className="hh-right">

            {/* Card identity panel */}
            <div style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border-card)",
              padding: "16px 18px",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Your living card
              </p>
              <h1 style={{
                margin: "0 0 10px",
                fontSize: 24,
                color: "var(--text-accent)",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
                textShadow: "0 1px 0 rgba(0,0,0,0.8), 0 -1px 0 rgba(255,215,0,0.1)",
              }}>
                {cardTitle}
              </h1>

              {/* Badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                {personality && (
                  <EraPill bg="rgba(124,58,237,0.2)" border="rgba(124,58,237,0.6)" color="#7C3AED" label={personality} />
                )}
                <EraPill bg={eraStyle.bg} border={eraStyle.border} color={eraStyle.text} label={era} />
                <EraPill bg="rgba(107,114,128,0.2)" border="rgba(107,114,128,0.5)" color="#9CA3AF" label={card.rarity ?? "Common"} />
              </div>

              {/* 2×2 stats grid: POWER / BUILD / REP / BORN */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, border: "1px solid var(--border-card)", marginBottom: 12 }}>
                <StatBox label="Power" value={card.hp != null ? String(card.hp) : "—"} />
                <StatBox label="Build" value={snap.build_score != null ? String(snap.build_score) : "—"} />
                <StatBox label="Rep" value={card.mod_count != null ? String(card.mod_count) : "—"} />
                <StatBox label="Born" value={mintDate ?? "—"} small />
              </div>

              {/* Flavor text */}
              {card.flavor_text && (
                <div style={{
                  padding: "10px 12px",
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--border-card)",
                }}>
                  <p style={{ margin: 0, fontSize: 11, fontStyle: "italic", color: "var(--text-dim)", lineHeight: 1.55 }}>
                    &ldquo;{card.flavor_text}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Build panel */}
            <div style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              padding: "14px 16px",
            }}>
              <p style={{ margin: "0 0 8px", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                The build
              </p>
              <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {carYear} {carMake} {carModel}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <BuildLine label="Biggest mod" value={biggestModName} extra={biggestModCost != null ? `$${biggestModCost.toLocaleString()}` : null} />
                <BuildLine label="Latest add" value={latestModName} />
                <BuildLine label="Installed" value={String(installedModCount)} />
                <BuildLine label="Wishlist" value={`${wishlistCount}${wishlistCost > 0 ? ` · $${(wishlistCost / 1000).toFixed(1)}k` : ""}`} />
              </div>
            </div>

            {/* Remint */}
            <Link
              href="/mint"
              className="mv-btn mv-btn-danger"
              style={{ width: "100%", boxSizing: "border-box" }}
            >
              <Flame size={11} /> Remint
            </Link>

            {/* Quick links */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Link href="/garage" className="mv-btn mv-btn-ghost" style={{ textDecoration: "none" }}>
                Garage
              </Link>
              <Link href="/community" className="mv-btn mv-btn-ghost" style={{ textDecoration: "none" }}>
                Community
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Chat drawer ─────────────────────────────────────────────────────── */}
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
          <div style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 560,
            background: "var(--bg-raised)",
            border: "1px solid var(--border-card)",
            padding: "14px 14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            animation: "hhFadeUp 250ms cubic-bezier(0.16,1,0.3,1) both",
            boxShadow: "var(--shadow-deep)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-primary)", letterSpacing: "0.04em" }}>
                  {cardTitle}
                </p>
                <p style={{ margin: "1px 0 0", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {personality ?? "Your card"}
                </p>
              </div>
              <button
                onClick={closeChat}
                aria-label="Close chat"
                style={{
                  width: 28, height: 28,
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Messages */}
            {messages.length > 0 && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 260,
                overflowY: "auto",
                padding: "4px 2px",
              }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "85%",
                      padding: "8px 12px",
                      background: m.role === "user" ? "var(--bg-sunken)" : "transparent",
                      border: m.role === "user" ? "1px solid var(--border-subtle)" : "none",
                      borderLeft: m.role === "card" ? "2px solid var(--era-dawn)" : undefined,
                    }}>
                      <p style={{
                        margin: 0,
                        fontSize: 12,
                        color: m.role === "card" ? "var(--text-primary)" : "var(--text-dim)",
                        lineHeight: 1.55,
                        fontStyle: m.role === "card" ? "italic" : "normal",
                      }}>
                        {m.content || (
                          <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                            {[0, 1, 2].map((j) => (
                              <span key={j} style={{
                                display: "inline-block",
                                width: 4, height: 4,
                                background: "var(--text-dim)",
                                borderRadius: "50%",
                                animation: `hhDotBounce 1.2s ease-in-out ${j * 0.2}s infinite`,
                              }} />
                            ))}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Chat error */}
            {chatError && (
              <div style={{
                padding: "6px 10px",
                background: "rgba(220,38,38,0.1)",
                border: "1px solid rgba(220,38,38,0.3)",
                color: "var(--text-danger)",
                fontSize: 10,
              }}>
                {chatError}
              </div>
            )}

            {/* Input */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 4px 4px 12px",
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-card)",
            }}>
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
                  color: "var(--text-primary)",
                  fontSize: 12,
                  padding: "8px 0",
                  fontFamily: "'m6x11', monospace",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                aria-label="Send"
                className={`mv-btn ${input.trim() && !streaming ? "mv-btn-primary" : "mv-btn-ghost"}`}
                style={{
                  padding: "6px 10px",
                  flexShrink: 0,
                  opacity: !input.trim() || streaming ? 0.5 : 1,
                }}
              >
                {streaming ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Card modal ────────────────────────────────────────────────────────── */}
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

function EraPill({
  bg,
  border,
  color,
  label,
}: {
  bg: string;
  border: string;
  color: string;
  label: string;
}) {
  return (
    <span style={{
      fontSize: 9,
      padding: "3px 10px",
      background: bg,
      border: `1px solid ${border}`,
      color,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    }}>
      {label}
    </span>
  );
}

function StatBox({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "8px 6px",
      background: "var(--bg-sunken)",
      gap: 2,
    }}>
      <span style={{
        fontSize: 8,
        color: "var(--text-dim)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: small ? 11 : 16,
        color: "var(--text-primary)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}>
        {value}
      </span>
    </div>
  );
}

function BuildLine({
  label,
  value,
  extra,
}: {
  label: string;
  value: string | null;
  extra?: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <p style={{
        margin: 0,
        fontSize: 8,
        color: "var(--text-dim)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}>
        {label}
      </p>
      <p style={{
        margin: 0,
        fontSize: 11,
        color: value ? "var(--text-primary)" : "var(--text-dim)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {value ?? "—"}
        {extra && (
          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-dim)" }}>{extra}</span>
        )}
      </p>
    </div>
  );
}
