"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { TradingCard } from "@/components/garage/trading-card";
import { safeEra } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

interface ChatMessage {
  role: "user" | "card";
  content: string;
}

type FullCard = MintedCard & {
  card_title?: string | null;
  personality?: string | null;
};

interface CardTalkProps {
  card: MintedCard;
  carLabel: string;
}

export function CardTalk({ card, carLabel }: CardTalkProps) {
  const detail = card as FullCard;
  const cardTitle = detail.card_title ?? detail.nickname;
  const personality = detail.personality;
  const snap = detail.car_snapshot;
  const era = safeEra(card.era);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [wiggle, setWiggle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  // Seed with opening line on load
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/card-poke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: card.id }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.line?.trim()) {
          setMessages([{ role: "card", content: json.line.trim() }]);
        }
      } catch { /* silent */ }
    }, 500);
    return () => clearTimeout(t);
  }, [card.id]);

  const sendMessage = useCallback(async () => {
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
          try { errMsg = JSON.parse(text).error ?? text ?? errMsg; } catch { if (text) errMsg = text; }
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
      if (!full.trim()) {
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
  }, [input, streaming, messages, card.id]);

  return (
    <div style={{
      display: "flex",
      gap: 32,
      maxWidth: 960,
      margin: "0 auto",
      padding: "32px 20px 40px",
      minHeight: "100dvh",
      alignItems: "flex-start",
    }}>

      {/* ── Left: card ── */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 32,
      }}
        className="card-talk-left"
      >
        <TradingCard
          cardUrl={card.pixel_card_url}
          nickname={card.nickname}
          generatedAt={card.minted_at}
          hp={card.hp}
          modCount={card.mod_count}
          buildScore={snap.build_score ?? null}
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
          carLabel={carLabel}
          scale={0.85}
          idle={!wiggle}
          wiggle={wiggle}
          interactive
        />

        {/* Era + personality */}
        <div style={{ textAlign: "center" }}>
          <p style={{
            margin: 0,
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
          }}>
            {era} · {personality ?? "Unknown"}
          </p>
        </div>
      </div>

      {/* ── Right: chat ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        gap: 12,
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 18px",
          background: "var(--bg-raised)",
          border: "1px solid var(--border-card)",
        }}>
          <p style={{
            margin: "0 0 2px",
            fontSize: 18,
            color: "var(--text-accent)",
            letterSpacing: "-0.01em",
          }}>
            {cardTitle}
          </p>
          <p style={{
            margin: 0,
            fontSize: 9,
            color: "var(--text-dim)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}>
            {carLabel}
          </p>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          background: "var(--bg-raised)",
          border: "1px solid var(--border-card)",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 320,
          maxHeight: "calc(100dvh - 300px)",
          overflowY: "auto",
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 8,
              opacity: 0.4,
            }}>
              <Sparkles size={20} style={{ color: "var(--text-dim)" }} />
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
                Say something…
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "82%",
                padding: "9px 13px",
                background: m.role === "user" ? "var(--bg-sunken)" : "transparent",
                border: m.role === "user" ? "1px solid var(--border-subtle)" : "none",
                borderLeft: m.role === "card" ? "2px solid var(--era-dawn)" : undefined,
              }}>
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  color: m.role === "card" ? "var(--text-primary)" : "var(--text-dim)",
                  lineHeight: 1.6,
                  fontStyle: m.role === "card" ? "italic" : "normal",
                }}>
                  {m.content || (
                    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                      {[0, 1, 2].map((j) => (
                        <span key={j} style={{
                          display: "inline-block",
                          width: 4, height: 4,
                          background: "var(--text-dim)",
                          borderRadius: "50%",
                          animation: `ctDotBounce 1.2s ease-in-out ${j * 0.2}s infinite`,
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

        {/* Error */}
        {chatError && (
          <div style={{
            padding: "7px 12px",
            background: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.25)",
            color: "var(--text-danger)",
            fontSize: 10,
            letterSpacing: "0.04em",
          }}>
            {chatError}
          </div>
        )}

        {/* Input */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 4px 4px 14px",
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
              fontSize: 13,
              padding: "10px 0",
              fontFamily: "'m6x11', monospace",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            aria-label="Send"
            className={`mv-btn ${input.trim() && !streaming ? "mv-btn-primary" : "mv-btn-ghost"}`}
            style={{
              padding: "8px 14px",
              flexShrink: 0,
              opacity: !input.trim() || streaming ? 0.45 : 1,
            }}
          >
            {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ctDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%           { transform: translateY(-5px); opacity: 1; }
        }
        @media (max-width: 600px) {
          .card-talk-left { display: none; }
        }
      `}</style>
    </div>
  );
}
