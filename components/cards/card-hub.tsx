"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Send, Swords, Clock, Sparkles, Loader2, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { TradingCard } from "@/components/garage/trading-card";
import type { MintedCard } from "@/lib/pixel-card";

// ── Types ─────────────────────────────────────────────────────────

type FullCard = MintedCard & {
  personality?: string | null;
  card_level?: number | null;
  card_title?: string | null;
  status?: string;
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
  carLabels: Record<string, string>;
}

// ── Speech Bubble ─────────────────────────────────────────────────

function SpeechBubble({ text, side = "right" }: { text: string; side?: "right" | "top" }) {
  return (
    <div style={{ position: "relative", display: "inline-block", maxWidth: 280 }}>
      <div style={{
        background: "rgba(18,14,35,0.95)",
        border: "1px solid rgba(168,85,247,0.5)",
        borderRadius: 14,
        padding: "12px 16px",
        fontSize: 13,
        lineHeight: 1.6,
        color: "#f0e8ff",
        fontStyle: "italic",
        boxShadow: "0 4px 24px rgba(168,85,247,0.2)",
      }}>
        {text}
      </div>
      {/* Pointer triangle toward the card */}
      <div style={{
        position: "absolute",
        [side === "right" ? "left" : "bottom"]: side === "right" ? -10 : "50%",
        [side === "right" ? "top" : "left"]: side === "right" ? 20 : -8,
        width: 0, height: 0,
        borderTop: side === "right" ? "8px solid transparent" : undefined,
        borderBottom: side === "right" ? "8px solid transparent" : "10px solid rgba(168,85,247,0.5)",
        borderRight: side === "right" ? "10px solid rgba(168,85,247,0.5)" : "8px solid transparent",
        borderLeft: side === "right" ? undefined : "8px solid transparent",
      }} />
    </div>
  );
}

// ── Ghost Card Row ────────────────────────────────────────────────

function GhostRow({ card, carLabel }: { card: FullCard; carLabel: string }) {
  const snap = card.car_snapshot;
  const burnDate = card.burned_at ? new Date(card.burned_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
  const mintDate = new Date(card.minted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return (
    <div style={{
      display: "flex", gap: 14, padding: "14px 0",
      borderBottom: "1px solid rgba(168,85,247,0.08)",
      alignItems: "flex-start",
    }}>
      {/* Card thumbnail — greyed out */}
      <div style={{ flexShrink: 0 }}>
        <img
          src={card.pixel_card_url}
          alt={card.nickname}
          width={60} height={60}
          style={{
            width: 60, height: 60, objectFit: "cover",
            borderRadius: 8,
            filter: "grayscale(0.85) brightness(0.55)",
            border: "1px solid rgba(168,85,247,0.15)",
            imageRendering: "pixelated",
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {/* Skull SVG */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2C7.03 2 3 6.03 3 11c0 3.1 1.5 5.85 3.8 7.58V21h10.4v-2.42C19.5 16.85 21 14.1 21 11c0-4.97-4.03-9-9-9z" fill="rgba(200,180,240,0.35)"/>
            <path d="M9 14v2M15 14v2M9 11a1 1 0 100-2 1 1 0 000 2zM15 11a1 1 0 100-2 1 1 0 000 2z" stroke="rgba(200,180,240,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(200,180,240,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.card_title ?? card.nickname}
          </span>
          {card.card_level && (
            <span style={{ fontSize: 9, color: "rgba(245,215,110,0.5)", fontFamily: "ui-monospace, monospace", fontWeight: 700, flexShrink: 0 }}>
              LVL {card.card_level}
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: "rgba(200,180,240,0.35)", marginBottom: 4 }}>
          {snap.year} {snap.make} {snap.model} · {card.personality ?? ""}
        </p>
        <p style={{ fontSize: 10, color: "rgba(200,180,240,0.25)", fontFamily: "ui-monospace, monospace" }}>
          Born {mintDate}{burnDate ? ` · Burned ${burnDate}` : ""}
        </p>
        {card.last_words && (
          <p style={{ fontSize: 11, fontStyle: "italic", color: "rgba(200,180,240,0.45)", marginTop: 6, lineHeight: 1.5 }}>
            &ldquo;{card.last_words}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ── Battle Panel ──────────────────────────────────────────────────

function BattlePanel({ cardId, cardTitle }: { cardId: string; cardTitle: string }) {
  const [recentBattles, setRecentBattles] = useState<{ id: string; challenger_title: string | null; defender_title: string | null; challenger_score: number; defender_score: number; battled_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [challenging, setChallenging] = useState(false);
  const [challengeResult, setChallengeResult] = useState<{ outcome: string; scoreC: number; scoreO: number } | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [opponentId, setOpponentId] = useState("");

  useEffect(() => {
    fetch("/api/battles/recent")
      .then(r => r.json())
      .then(j => setRecentBattles((j.battles ?? []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function quickChallenge(opponentCardId: string) {
    setChallenging(true);
    setChallengeError(null);
    setChallengeResult(null);
    try {
      const res = await fetch("/api/battles/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenger_card_id: cardId, opponent_card_id: opponentCardId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Battle failed");
      setChallengeResult({ outcome: json.outcome, scoreC: json.breakdown.challenger, scoreO: json.breakdown.opponent });
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "Failed");
    } finally {
      setChallenging(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "rgba(200,180,240,0.6)", marginBottom: 12 }}>
          Paste an opponent card ID to challenge, or pick from recent battles below.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={opponentId}
            onChange={e => setOpponentId(e.target.value)}
            placeholder="Opponent card ID..."
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 12,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168,85,247,0.25)",
              color: "#f0e8ff", outline: "none",
            }}
          />
          <button
            onClick={() => opponentId && quickChallenge(opponentId)}
            disabled={!opponentId || challenging}
            style={{
              padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 12,
              background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
              color: "#ff453a", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              opacity: (!opponentId || challenging) ? 0.4 : 1,
            }}
          >
            {challenging ? <Loader2 size={13} className="animate-spin" /> : <Swords size={13} />}
            Fight
          </button>
        </div>
        {challengeError && <p style={{ fontSize: 11, color: "#ff453a", marginTop: 8 }}>{challengeError}</p>}
        {challengeResult && (
          <div style={{
            marginTop: 12, padding: "12px 16px", borderRadius: 12, textAlign: "center",
            background: challengeResult.outcome.startsWith("win") ? "rgba(48,209,88,0.08)" : "rgba(255,69,58,0.08)",
            border: `1px solid ${challengeResult.outcome.startsWith("win") ? "rgba(48,209,88,0.35)" : "rgba(255,69,58,0.35)"}`,
          }}>
            <p style={{ fontSize: 16, fontWeight: 900, color: challengeResult.outcome.startsWith("win") ? "#30d158" : "#ff453a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {challengeResult.outcome.replace("_", " ")}
            </p>
            <p style={{ fontSize: 11, color: "rgba(200,180,240,0.6)", fontFamily: "ui-monospace, monospace", marginTop: 4 }}>
              {challengeResult.scoreC.toFixed(1)} vs {challengeResult.scoreO.toFixed(1)}
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <Loader2 size={16} style={{ color: "rgba(200,180,240,0.3)", display: "block", margin: "0 auto" }} className="animate-spin" />
      ) : recentBattles.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(200,180,240,0.4)", marginBottom: 8, fontFamily: "ui-monospace, monospace" }}>
            Recent Community Battles
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentBattles.map(b => {
              const notMine = b.challenger_title !== cardTitle;
              const opponentCardId = notMine ? b.id : null; // simplified — use challenger_card_id from API for real impl
              return (
                <div key={b.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 10, background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(168,85,247,0.12)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: "rgba(200,180,240,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.challenger_title ?? "?"} <span style={{ color: "rgba(200,180,240,0.3)" }}>vs</span> {b.defender_title ?? "?"}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "rgba(200,180,240,0.4)", flexShrink: 0 }}>
                    {Math.round(b.challenger_score)} — {Math.round(b.defender_score)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CardHub ──────────────────────────────────────────────────

export function CardHub({ liveCard, ghosts, carLabels }: CardHubProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"ghosts" | "battle">("ghosts");
  const [tabsOpen, setTabsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snap = liveCard?.car_snapshot;
  const carLabel = liveCard ? (carLabels[liveCard.car_id ?? ""] ?? (snap ? `${snap.year} ${snap.make} ${snap.model}` : "")) : "";

  // Show a bubble for N seconds then hide
  const showBubble = useCallback((text: string) => {
    setBubble(text);
    setBubbleVisible(true);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => setBubbleVisible(false), 9000);
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
    const newHistory = [...messages.map(m => ({ role: m.role === "card" ? "assistant" : "user", content: m.content } as { role: "user" | "assistant"; content: string }))];
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/card-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: liveCard.id, message: userMsg, history: newHistory }),
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

  // ── No card state ──────────────────────────────────────────────
  if (!liveCard) {
    return (
      <div style={{
        minHeight: "80vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20, padding: 32,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: "rgba(123,79,212,0.1)", border: "1px dashed rgba(123,79,212,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Sparkles size={28} style={{ color: "rgba(168,85,247,0.4)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
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
        {ghosts.length > 0 && (
          <div style={{ width: "100%", maxWidth: 500, marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(200,180,240,0.35)", marginBottom: 12, fontFamily: "ui-monospace, monospace" }}>
              Past Cards ({ghosts.length})
            </p>
            {ghosts.map(g => (
              <GhostRow key={g.id} card={g} carLabel={carLabels[g.car_id ?? ""] ?? ""} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const cardPersonality = (liveCard as FullCard).personality;
  const cardLevel = (liveCard as FullCard).card_level;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Hero: Card + Bubble ─────────────────────────────────── */}
      <div style={{
        background: "radial-gradient(ellipse 100% 70% at 50% 0%, rgba(123,79,212,0.12) 0%, transparent 60%)",
        padding: "32px 24px 24px",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        gap: 32, flexWrap: "wrap",
      }}>
        {/* Card */}
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
            torque={snap?.torque ?? null}
            zeroToSixty={snap?.zero_to_sixty ?? null}
            totalInvested={snap?.total_invested ?? null}
            carLabel={carLabel}
            personality={cardPersonality}
            cardLevel={cardLevel}
            scale={1.1}
            idle
            interactive
          />
          {/* Alive indicator */}
          <div style={{
            position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 20,
            background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.3)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#30d158", boxShadow: "0 0 6px #30d158", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#30d158", fontFamily: "ui-monospace, monospace" }}>
              Alive
            </span>
          </div>
        </div>

        {/* Right: Speech bubble + card info */}
        <div style={{ flex: 1, minWidth: 240, maxWidth: 380, paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Speech bubble */}
          <div style={{
            minHeight: 72,
            opacity: bubbleVisible ? 1 : 0,
            transform: bubbleVisible ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
            transition: "opacity 300ms ease, transform 300ms ease",
          }}>
            {bubble && <SpeechBubble text={bubble} />}
          </div>

          {/* Card info */}
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#f0e8ff", marginBottom: 4 }}>
              {(liveCard as FullCard).card_title ?? liveCard.nickname}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {cardPersonality && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)", color: "#e9d5ff" }}>
                  {cardPersonality}
                </span>
              )}
              {cardLevel && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(245,215,110,0.1)", border: "1px solid rgba(245,215,110,0.25)", color: "rgba(245,215,110,0.8)" }}>
                  Level {cardLevel}
                </span>
              )}
              <span style={{ fontSize: 10, color: "rgba(200,180,240,0.45)" }}>
                {carLabel}
              </span>
            </div>
            <Link href="/mint" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 700, color: "rgba(168,85,247,0.6)",
              textDecoration: "none", letterSpacing: "0.06em",
            }}>
              <Sparkles size={11} /> Mint new card →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Chat area ─────────────────────────────────────────── */}
      <div style={{
        flex: 1, maxWidth: 640, width: "100%", margin: "0 auto",
        padding: "0 16px 0", display: "flex", flexDirection: "column",
      }}>
        {/* Chat messages */}
        <div style={{
          flex: 1, overflowY: "auto", paddingBottom: 8,
          display: "flex", flexDirection: "column", gap: 10,
          maxHeight: 340, minHeight: 120, padding: "16px 0",
        }}>
          {messages.length === 0 && !isStreaming && (
            <p style={{ textAlign: "center", fontSize: 12, color: "rgba(200,180,240,0.3)", fontStyle: "italic", padding: "20px 0" }}>
              Your card is waiting...
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              gap: 8, alignItems: "flex-end",
            }}>
              {m.role === "card" && (
                <img src={liveCard.pixel_card_url} alt="" width={24} height={24}
                  style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover", flexShrink: 0, imageRendering: "pixelated", opacity: 0.7 }}
                />
              )}
              <div style={{
                maxWidth: "75%", padding: "10px 14px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.role === "user" ? "rgba(168,85,247,0.35)" : "rgba(15,12,30,0.8)",
                border: m.role === "user" ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(168,85,247,0.2)",
                fontSize: 13, lineHeight: 1.55,
                color: m.role === "user" ? "#f0e8ff" : "#e8e0ff",
                fontStyle: m.role === "card" ? "italic" : "normal",
              }}>
                {m.content || (isStreaming && i === messages.length - 1 ? (
                  <span style={{ display: "inline-flex", gap: 3 }}>
                    {[0, 1, 2].map(d => (
                      <span key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(168,85,247,0.6)", display: "inline-block", animation: `dotBounce 1s ease-in-out ${d * 0.2}s infinite` }} />
                    ))}
                  </span>
                ) : "...")}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          display: "flex", gap: 8, padding: "12px 0 16px",
          borderTop: "1px solid rgba(168,85,247,0.12)",
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Say something to ${(liveCard as FullCard).card_title ?? liveCard.nickname}...`}
            disabled={isStreaming}
            style={{
              flex: 1, padding: "11px 16px", borderRadius: 12, fontSize: 13,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168,85,247,0.25)",
              color: "#f0e8ff", outline: "none",
              opacity: isStreaming ? 0.5 : 1,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)",
              color: "#e9d5ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: (!input.trim() || isStreaming) ? 0.35 : 1, transition: "opacity 150ms",
            }}
            aria-label="Send message"
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* ── Tabs: Ghosts / Battle ──────────────────────────────── */}
      <div style={{
        maxWidth: 640, width: "100%", margin: "0 auto",
        borderTop: "1px solid rgba(168,85,247,0.12)", padding: "0 16px 32px",
      }}>
        {/* Tab toggle */}
        <div style={{ display: "flex", gap: 1, margin: "16px 0" }}>
          <button
            onClick={() => { setActiveTab("ghosts"); setTabsOpen(t => activeTab === "ghosts" ? !t : true); }}
            style={{
              flex: 1, padding: "10px 0", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              background: activeTab === "ghosts" && tabsOpen ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
              border: "1px solid rgba(168,85,247,0.18)", borderRight: "none",
              borderRadius: "10px 0 0 10px", color: "rgba(200,180,240,0.7)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Clock size={12} /> Ghosts {ghosts.length > 0 && `(${ghosts.length})`}
            {activeTab === "ghosts" && (tabsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
          </button>
          <button
            onClick={() => { setActiveTab("battle"); setTabsOpen(t => activeTab === "battle" ? !t : true); }}
            style={{
              flex: 1, padding: "10px 0", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              background: activeTab === "battle" && tabsOpen ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)",
              border: "1px solid rgba(168,85,247,0.18)",
              borderRadius: "0 10px 10px 0", color: "rgba(200,180,240,0.7)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Swords size={12} /> Battle
            {activeTab === "battle" && (tabsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
          </button>
        </div>

        {tabsOpen && (
          <div style={{
            padding: "16px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(168,85,247,0.12)",
            borderRadius: 12,
          }}>
            {activeTab === "ghosts" && (
              ghosts.length === 0 ? (
                <p style={{ textAlign: "center", fontSize: 12, color: "rgba(200,180,240,0.35)", padding: "20px 0" }}>
                  No ghost cards yet. Your history starts with your first burn.
                </p>
              ) : (
                ghosts.map(g => <GhostRow key={g.id} card={g} carLabel={carLabels[g.car_id ?? ""] ?? ""} />)
              )
            )}
            {activeTab === "battle" && (
              <BattlePanel cardId={liveCard.id} cardTitle={(liveCard as FullCard).card_title ?? liveCard.nickname} />
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes dotBounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-5px); } }
      `}</style>
    </div>
  );
}
