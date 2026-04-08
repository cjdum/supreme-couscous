"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Send, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PixelCardSnapshot } from "@/lib/supabase/types";

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
  // personality is optional — not yet in schema but may exist
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

// ── Sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <span
      className="inline-flex items-center gap-1.5 h-5"
      aria-label="Card is typing"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full"
          style={{
            background: "rgba(168,85,247,0.7)",
            animation: `cardTypingPulse 1.2s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes cardTypingPulse {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-3px);
          }
        }
      `}</style>
    </span>
  );
}

function SkeletonLoader() {
  return (
    <div
      style={{ background: "#08080f", minHeight: "100dvh" }}
      className="flex flex-col"
    >
      {/* Header skeleton */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(168,85,247,0.15)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: "rgba(168,85,247,0.1)",
            animation: "skeletonPulse 1.5s ease-in-out infinite",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              width: 120,
              height: 14,
              borderRadius: 4,
              background: "rgba(168,85,247,0.1)",
              animation: "skeletonPulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              width: 80,
              height: 10,
              borderRadius: 4,
              background: "rgba(168,85,247,0.07)",
              animation: "skeletonPulse 1.5s ease-in-out 0.2s infinite",
            }}
          />
        </div>
      </div>
      <style jsx global>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function NoCardState() {
  return (
    <div
      style={{
        background: "#08080f",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: "rgba(107,70,193,0.12)",
          border: "2px solid rgba(107,70,193,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 28,
            lineHeight: 1,
            fontFamily: "ui-monospace, monospace",
            color: "rgba(168,85,247,0.4)",
          }}
        >
          ?
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(220,200,255,0.8)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          No living card
        </p>
        <p
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            color: "rgba(160,140,200,0.4)",
            letterSpacing: "0.04em",
            maxWidth: 260,
            lineHeight: 1.6,
          }}
        >
          You have no living card to chat with. Go mint one.
        </p>
      </div>

      <Link
        href="/mint"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 22px",
          borderRadius: 12,
          background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
          border: "1px solid rgba(123,79,212,0.5)",
          color: "white",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
          boxShadow: "0 4px 20px rgba(123,79,212,0.35)",
        }}
      >
        Mint a Card
        <ArrowUpRight size={13} />
      </Link>
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userScrolledUpRef = useRef(false);

  // ── Fetch alive card ───────────────────────────────────────────────────────
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
        .select(
          "id, card_title, nickname, pixel_card_url, build_archetype, car_snapshot, occasion, minted_at",
        )
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

  // ── Fetch opening line once card is loaded ─────────────────────────────────
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
        const json = await res.json().catch(() => ({}));
        setMessages([
          {
            role: "assistant",
            content:
              (json as { error?: string }).error ??
              "Something went wrong loading the opening line.",
          },
        ]);
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
      setMessages([
        { role: "assistant", content: "Connection error loading opening line." },
      ]);
    } finally {
      setOpeningPending(false);
    }
  }, []);

  useEffect(() => {
    if (card) {
      fetchOpeningLine(card.id);
    }
  }, [card, fetchOpeningLine]);

  // ── Scroll tracking ────────────────────────────────────────────────────────
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      userScrolledUpRef.current = scrollHeight - (scrollTop + clientHeight) > 100;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (userScrolledUpRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // ── Auto-grow textarea ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 22 * 3 + 28;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

  // ── Send a message ─────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    if (!text.trim() || streaming || openingPending || !card) return;

    userScrolledUpRef.current = false;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });

    const cleanHistory: Message[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

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
          history: cleanHistory.slice(-16).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content:
              (json as { error?: string }).error ??
              "Something went wrong. Please try again.",
          },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: fullText },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) return <SkeletonLoader />;
  if (noCard || !card) return <NoCardState />;

  const personality = resolvePersonality(card);
  const { year, make, model } = card.car_snapshot;
  const displayName = card.card_title || card.nickname;
  const isWaiting = streaming || openingPending;

  return (
    <div
      style={{
        background: "#08080f",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header
        style={{
          flexShrink: 0,
          borderBottom: "1px solid rgba(168,85,247,0.15)",
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "12px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Card image thumbnail */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.pixel_card_url}
            alt={displayName}
            width={40}
            height={40}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              objectFit: "cover",
              border: "1px solid rgba(168,85,247,0.3)",
              flexShrink: 0,
              imageRendering: "pixelated",
            }}
          />

          {/* Card name + personality + living dot */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "rgba(220,200,255,0.95)",
                  letterSpacing: "0.03em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 160,
                }}
              >
                {displayName}
              </span>

              {/* Personality chip */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(107,70,193,0.25)",
                  border: "1px solid rgba(168,85,247,0.3)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(192,132,252,0.9)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {personality}
              </span>

              {/* Living dot */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 10,
                  color: "rgba(74,222,128,0.8)",
                  letterSpacing: "0.04em",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#4ade80",
                    boxShadow: "0 0 6px rgba(74,222,128,0.7)",
                    display: "inline-block",
                  }}
                />
                Living
              </span>
            </div>

            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                color: "rgba(148,120,190,0.55)",
                marginTop: 2,
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {year} {make} {model}
            </p>
          </div>
        </div>
      </header>

      {/* ── Messages area ────────────────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const isLast = i === messages.length - 1;
            const showTyping = !isUser && isLast && isWaiting && !msg.content;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                }}
              >
                {/* Card avatar — shown left of card messages */}
                {!isUser && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={card.pixel_card_url}
                    alt=""
                    aria-hidden="true"
                    width={28}
                    height={28}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      objectFit: "cover",
                      border: "1px solid rgba(168,85,247,0.2)",
                      flexShrink: 0,
                      marginRight: 8,
                      imageRendering: "pixelated",
                      alignSelf: "flex-end",
                      marginBottom: 2,
                    }}
                  />
                )}

                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 14px",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isUser
                      ? "rgba(168,85,247,0.5)"
                      : "rgba(107,70,193,0.3)",
                    border: `1px solid ${
                      isUser
                        ? "rgba(168,85,247,0.4)"
                        : "rgba(168,85,247,0.3)"
                    }`,
                    color: "rgba(240,230,255,0.95)",
                    fontSize: 14,
                    lineHeight: 1.55,
                    fontFamily:
                      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    wordBreak: "break-word",
                    // Subtle fade-in
                    animation: "msgFadeIn 200ms ease both",
                  }}
                >
                  {showTyping ? (
                    <TypingIndicator />
                  ) : (
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      <footer
        style={{
          flexShrink: 0,
          borderTop: "1px solid rgba(168,85,247,0.15)",
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          {/* Textarea */}
          <div
            style={{
              flex: 1,
              borderRadius: 16,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(168,85,247,0.2)",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor =
                "rgba(168,85,247,0.5)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor =
                "rgba(168,85,247,0.2)";
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isWaiting
                  ? `${displayName} is thinking...`
                  : `Say something to ${displayName}...`
              }
              rows={1}
              disabled={isWaiting}
              aria-label="Message"
              style={{
                width: "100%",
                resize: "none",
                background: "transparent",
                border: "none",
                outline: "none",
                padding: "12px 16px",
                color: "rgba(230,215,255,0.95)",
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                minHeight: 48,
                maxHeight: 100,
                display: "block",
                opacity: isWaiting ? 0.5 : 1,
              }}
            />
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isWaiting}
            aria-label="Send message"
            style={{
              width: 48,
              height: 48,
              minWidth: 48,
              minHeight: 48,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: input.trim() && !isWaiting ? "pointer" : "default",
              flexShrink: 0,
              background:
                input.trim() && !isWaiting
                  ? "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)"
                  : "rgba(255,255,255,0.05)",
              border: input.trim() && !isWaiting
                ? "1px solid rgba(123,79,212,0.5)"
                : "1px solid rgba(168,85,247,0.15)",
              opacity: !input.trim() || isWaiting ? 0.4 : 1,
              transition: "background 150ms, opacity 150ms",
              boxShadow:
                input.trim() && !isWaiting
                  ? "0 2px 12px rgba(123,79,212,0.4)"
                  : "none",
            }}
          >
            <Send
              size={15}
              style={{
                color:
                  input.trim() && !isWaiting
                    ? "white"
                    : "rgba(168,85,247,0.5)",
              }}
            />
          </button>
        </div>
      </footer>

      {/* ── Global keyframe styles ────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes msgFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
