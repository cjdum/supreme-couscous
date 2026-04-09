"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Send, Loader2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { TradingCard } from "@/components/garage/trading-card";
import { CardCollection } from "@/components/garage/card-collection";
import type { MintedCard } from "@/lib/pixel-card";

// ── Types ─────────────────────────────────────────────────────────────────────

type FullCard = MintedCard & {
  personality?: string | null;
  card_level?: number | null;
  card_title?: string | null;
  status?: string | null;
  burned_at?: string | null;
  last_words?: string | null;
};

interface ChatMessage {
  role: "user" | "card";
  content: string;
}

interface CardHubProps {
  liveCard: FullCard | null;
  ghosts: FullCard[];
  allCards: FullCard[];
  carLabels: Record<string, string>;
}

// ── Ghost Card Row ─────────────────────────────────────────────────────────────

function GhostRow({ card, carLabel }: { card: FullCard; carLabel: string }) {
  const snap = card.car_snapshot;
  const burnDate = card.burned_at
    ? new Date(card.burned_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const mintDate = new Date(card.minted_at).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
  return (
    <div style={{
      display: "flex", gap: 14, padding: "14px 0",
      borderBottom: "1px solid rgba(168,85,247,0.08)",
      alignItems: "flex-start",
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.pixel_card_url}
        alt={card.nickname}
        width={56} height={56}
        style={{
          width: 56, height: 56, objectFit: "cover",
          borderRadius: 8, flexShrink: 0,
          filter: "grayscale(0.85) brightness(0.5)",
          border: "1px solid rgba(168,85,247,0.12)",
          imageRendering: "pixelated",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2C7.03 2 3 6.03 3 11c0 3.1 1.5 5.85 3.8 7.58V21h10.4v-2.42C19.5 16.85 21 14.1 21 11c0-4.97-4.03-9-9-9z" fill="rgba(200,180,240,0.3)" />
            <path d="M9 14v2M15 14v2M9 11a1 1 0 100-2 1 1 0 000 2zM15 11a1 1 0 100-2 1 1 0 000 2z" stroke="rgba(200,180,240,0.45)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(200,180,240,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.card_title ?? card.nickname}
          </span>
          {card.card_level && (
            <span style={{ fontSize: 9, color: "rgba(245,215,110,0.45)", fontFamily: "ui-monospace, monospace", fontWeight: 700, flexShrink: 0 }}>
              LVL {card.card_level}
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: "rgba(200,180,240,0.3)", marginBottom: 3 }}>
          {snap.year} {snap.make} {snap.model}{card.personality ? ` · ${card.personality}` : ""}
        </p>
        <p style={{ fontSize: 10, color: "rgba(200,180,240,0.22)", fontFamily: "ui-monospace, monospace" }}>
          Born {mintDate}{burnDate ? ` · Burned ${burnDate}` : ""}
        </p>
        {card.last_words && (
          <p style={{ fontSize: 11, fontStyle: "italic", color: "rgba(200,180,240,0.4)", marginTop: 5, lineHeight: 1.5 }}>
            &ldquo;{card.last_words}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main CardHub ──────────────────────────────────────────────────────────────

export function CardHub({ liveCard, ghosts, allCards, carLabels }: CardHubProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [openSection, setOpenSection] = useState<"none" | "ghosts">("none");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snap = liveCard?.car_snapshot;
  const carLabel = liveCard
    ? (carLabels[liveCard.car_id ?? ""] ?? (snap ? `${snap.year} ${snap.make} ${snap.model}` : ""))
    : "";

  const showBubble = useCallback((text: string) => {
    setBubble(text);
    setBubbleVisible(true);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => setBubbleVisible(false), 10_000);
  }, []);

  // Fetch opening line on mount
  useEffect(() => {
    if (!liveCard) return;
    fetch("/api/card-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: liveCard.id, history: [] }),
    })
      .then(async (res) => {
        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
        }
        const line = full.trim();
        if (line) {
          showBubble(line);
          setMessages([{ role: "card", content: line }]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCard?.id]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || !liveCard || isStreaming) return;
    const userMsg = input.trim();
    setInput("");
    const historyForApi = messages.map(m => ({
      role: (m.role === "card" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/card-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: liveCard.id, message: userMsg, history: historyForApi }),
      });
      if (!res.body) { setIsStreaming(false); return; }

      let full = "";
      setMessages(prev => [...prev, { role: "card", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "card", content: full };
          return copy;
        });
      }
      if (full.trim()) showBubble(full.trim());
    } catch {
      setMessages(prev => [...prev, { role: "card", content: "..." }]);
    } finally {
      setIsStreaming(false);
    }
  }

  // ── No card state ──────────────────────────────────────────────────────────
  if (!liveCard) {
    return (
      <div style={{ padding: "32px 20px 64px" }}>
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "64px 24px", gap: 16, textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "rgba(123,79,212,0.1)", border: "1px dashed rgba(123,79,212,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={28} style={{ color: "rgba(168,85,247,0.4)" }} />
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "rgba(220,210,255,0.8)", marginBottom: 8 }}>
              No living card
            </p>
            <p style={{ fontSize: 13, color: "rgba(200,180,240,0.45)", marginBottom: 20 }}>
              Mint your first card to bring it to life.
            </p>
            <Link href="/mint" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: "linear-gradient(135deg, rgba(123,79,212,0.3) 0%, rgba(168,85,247,0.2) 100%)",
              border: "1px solid rgba(168,85,247,0.5)", color: "#e9d5ff", textDecoration: "none",
            }}>
              <Sparkles size={15} /> Mint your first card
            </Link>
          </div>
        </div>

        {/* Still show collection even with no live card */}
        {allCards.length > 0 && (
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 4px" }}>
            <CardCollection
              cards={allCards as MintedCard[]}
              carLabels={carLabels}
              hideSectionHeader={false}
            />
          </div>
        )}
      </div>
    );
  }

  const cardPersonality = liveCard.personality;
  const cardLevel = liveCard.card_level;
  const cardTitle = liveCard.card_title ?? liveCard.nickname;

  return (
    <div style={{ minHeight: "100vh" }}>
      <style>{`
        @keyframes pulseAlive { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes dotBounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-5px); } }
        @keyframes bubbleIn { from { opacity:0; transform:translateY(-6px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
      `}</style>

      {/* ── HERO: Card + Info Panel ──────────────────────────────────────────── */}
      <div style={{
        background: "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(123,79,212,0.1) 0%, transparent 60%)",
        padding: "28px 20px 20px",
      }}>
        <div style={{
          maxWidth: 900, margin: "0 auto",
          display: "flex", gap: 28, alignItems: "flex-start",
          flexWrap: "wrap",
        }}>
          {/* Card (left) */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <TradingCard
              cardUrl={liveCard.pixel_card_url}
              nickname={liveCard.nickname}
              generatedAt={liveCard.minted_at}
              hp={liveCard.hp}
              modCount={liveCard.mod_count}
              buildScore={snap?.build_score ?? null}
              vinVerified={snap?.vin_verified}
              cardNumber={liveCard.card_number}
              era={liveCard.era}
              rarity={liveCard.rarity}
              flavorText={liveCard.flavor_text}
              occasion={liveCard.occasion}
              mods={snap?.mods ?? []}
              modsDetail={snap?.mods_detail}
              torque={snap?.torque ?? null}
              zeroToSixty={snap?.zero_to_sixty ?? null}
              totalInvested={snap?.total_invested ?? null}
              carLabel={carLabel}
              personality={cardPersonality}
              cardLevel={cardLevel}
              scale={1.05}
              idle
              interactive
            />
            {/* Alive dot */}
            <div style={{
              position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)",
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 20,
              background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.25)",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#30d158", boxShadow: "0 0 6px #30d158",
                animation: "pulseAlive 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#30d158", fontFamily: "ui-monospace, monospace" }}>
                Alive
              </span>
            </div>
          </div>

          {/* Right panel: speech bubble + info + chat */}
          <div style={{ flex: 1, minWidth: 240, maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Speech bubble — appears on load / after each card response */}
            <div style={{
              minHeight: 64,
              transition: "opacity 300ms ease, transform 300ms ease",
              opacity: bubbleVisible ? 1 : 0,
              transform: bubbleVisible ? "translateY(0)" : "translateY(-8px)",
              pointerEvents: bubbleVisible ? "auto" : "none",
            }}>
              {bubble && (
                <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
                  {/* Pointer */}
                  <div style={{
                    position: "absolute", left: -9, top: 18,
                    width: 0, height: 0,
                    borderTop: "7px solid transparent",
                    borderBottom: "7px solid transparent",
                    borderRight: "9px solid rgba(168,85,247,0.45)",
                  }} />
                  <div style={{
                    background: "rgba(14,10,28,0.95)",
                    border: "1px solid rgba(168,85,247,0.45)",
                    borderRadius: "4px 14px 14px 14px",
                    padding: "12px 16px",
                    fontSize: 13, lineHeight: 1.65,
                    color: "#ede8ff",
                    fontStyle: "italic",
                    boxShadow: "0 4px 24px rgba(168,85,247,0.15)",
                    animation: "bubbleIn 250ms ease-out",
                  }}>
                    {bubble}
                  </div>
                </div>
              )}
            </div>

            {/* Card identity */}
            <div>
              <p style={{ fontSize: 17, fontWeight: 800, color: "#f0e8ff", marginBottom: 6 }}>
                {cardTitle}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {cardPersonality && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                    background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)",
                    color: "#e9d5ff", letterSpacing: "0.06em",
                  }}>
                    {cardPersonality}
                  </span>
                )}
                {cardLevel && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                    background: "rgba(245,215,110,0.08)", border: "1px solid rgba(245,215,110,0.22)",
                    color: "rgba(245,215,110,0.75)",
                  }}>
                    Level {cardLevel}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "rgba(200,180,240,0.5)", marginBottom: 10 }}>{carLabel}</p>

              {/* Quick stats */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
                {liveCard.hp != null && (
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(200,180,240,0.4)", fontFamily: "ui-monospace, monospace", marginBottom: 2 }}>HP</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "rgba(240,232,255,0.9)", fontFamily: "ui-monospace, monospace" }}>{liveCard.hp}</p>
                  </div>
                )}
                {liveCard.mod_count != null && (
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(200,180,240,0.4)", fontFamily: "ui-monospace, monospace", marginBottom: 2 }}>Mods</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "rgba(240,232,255,0.9)", fontFamily: "ui-monospace, monospace" }}>{liveCard.mod_count}</p>
                  </div>
                )}
                {snap?.total_invested != null && (
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(200,180,240,0.4)", fontFamily: "ui-monospace, monospace", marginBottom: 2 }}>Invested</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "rgba(240,232,255,0.9)", fontFamily: "ui-monospace, monospace" }}>${snap.total_invested.toLocaleString()}</p>
                  </div>
                )}
                {snap?.build_score != null && (
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(200,180,240,0.4)", fontFamily: "ui-monospace, monospace", marginBottom: 2 }}>Score</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "rgba(240,232,255,0.9)", fontFamily: "ui-monospace, monospace" }}>{snap.build_score}</p>
                  </div>
                )}
              </div>

              {/* Flavor text */}
              {liveCard.flavor_text && (
                <p style={{
                  fontSize: 11, fontStyle: "italic", lineHeight: 1.6,
                  color: "rgba(200,180,240,0.55)",
                  padding: "8px 12px", borderRadius: 8,
                  background: "rgba(123,79,212,0.07)",
                  border: "1px solid rgba(123,79,212,0.15)",
                  marginBottom: 10,
                }}>
                  {liveCard.flavor_text}
                </p>
              )}
            </div>

            {/* Chat input — integrated in the panel */}
            <div style={{ borderTop: "1px solid rgba(168,85,247,0.12)", paddingTop: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(200,180,240,0.35)", fontFamily: "ui-monospace, monospace", marginBottom: 8 }}>
                Talk to your card
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Say something to ${cardTitle}...`}
                  disabled={isStreaming}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 13,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168,85,247,0.22)",
                    color: "#f0e8ff", outline: "none",
                    opacity: isStreaming ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  aria-label="Send"
                  style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.35)",
                    color: "#e9d5ff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: (!input.trim() || isStreaming) ? 0.3 : 1,
                  }}
                >
                  {isStreaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CHAT LOG (conversation history) ─────────────────────────────────── */}
      {messages.length > 0 && (
        <div style={{
          maxWidth: 760, margin: "0 auto",
          padding: "20px 20px 4px",
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(200,180,240,0.3)", fontFamily: "ui-monospace, monospace", marginBottom: 12 }}>
            Conversation
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                flexDirection: m.role === "user" ? "row-reverse" : "row",
                gap: 8, alignItems: "flex-end",
              }}>
                {m.role === "card" && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={liveCard.pixel_card_url} alt="" width={24} height={24}
                    style={{
                      width: 24, height: 24, borderRadius: 6, objectFit: "cover",
                      flexShrink: 0, imageRendering: "pixelated", opacity: 0.65,
                    }}
                  />
                )}
                <div style={{
                  maxWidth: "78%",
                  padding: m.role === "card" ? "10px 14px" : "6px 12px",
                  borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "4px 12px 12px 12px",
                  background: m.role === "user" ? "rgba(168,85,247,0.2)" : "rgba(14,10,28,0.7)",
                  border: m.role === "user" ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(168,85,247,0.15)",
                  fontSize: m.role === "card" ? 13 : 12,
                  lineHeight: 1.55,
                  color: m.role === "user" ? "rgba(220,210,255,0.7)" : "#ede8ff",
                  fontStyle: m.role === "card" ? "italic" : "normal",
                }}>
                  {m.content || (isStreaming && i === messages.length - 1 ? (
                    <span style={{ display: "inline-flex", gap: 3 }}>
                      {[0, 1, 2].map(d => (
                        <span key={d} style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: "rgba(168,85,247,0.5)", display: "inline-block",
                          animation: `dotBounce 1s ease-in-out ${d * 0.2}s infinite`,
                        }} />
                      ))}
                    </span>
                  ) : "...")}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* ── COLLECTION (all cards, horizontal scroll per car) ───────────────── */}
      {allCards.length > 0 && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 8px" }}>
          <CardCollection
            cards={allCards as MintedCard[]}
            carLabels={carLabels}
            hideSectionHeader={false}
          />
        </div>
      )}

      {/* ── Ghosts section ─────────────────────────────────────── */}
      <div style={{
        maxWidth: 760, margin: "8px auto 0",
        padding: "0 20px 40px",
      }}>
        <button
          onClick={() => setOpenSection(s => s === "ghosts" ? "none" : "ghosts")}
          style={{
            width: "100%", padding: "9px 0",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            background: openSection === "ghosts" ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
            border: "1px solid rgba(168,85,247,0.18)", borderRadius: 10,
            color: "rgba(200,180,240,0.65)", cursor: "pointer",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2C7.03 2 3 6.03 3 11c0 3.1 1.5 5.85 3.8 7.58V21h10.4v-2.42C19.5 16.85 21 14.1 21 11c0-4.97-4.03-9-9-9z" fill="rgba(200,180,240,0.3)" />
          </svg>
          Ghosts {ghosts.length > 0 && `(${ghosts.length})`}
          {openSection === "ghosts" ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {openSection === "ghosts" && (
          <div style={{
            padding: "16px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(168,85,247,0.12)",
            borderTop: "none",
            borderRadius: "0 0 12px 12px",
          }}>
            {ghosts.length === 0
              ? <p style={{ textAlign: "center", fontSize: 12, color: "rgba(200,180,240,0.35)", padding: "20px 0" }}>
                  No ghost cards yet. Your history starts with your first burn.
                </p>
              : ghosts.map(g => (
                  <GhostRow key={g.id} card={g} carLabel={carLabels[g.car_id ?? ""] ?? ""} />
                ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
