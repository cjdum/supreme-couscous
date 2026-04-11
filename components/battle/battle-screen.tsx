"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords, Trophy, Clock, CheckCircle2 } from "lucide-react";
import { safeArchetype, ARCHETYPE_COLORS } from "@/lib/card-personality";
import { TradingCard } from "@/components/garage/trading-card";
import type { MintedCard } from "@/lib/pixel-card";

interface BattleChallenge {
  id: string;
  challenger_card_id: string;
  opponent_card_id: string;
  challenger_user_id: string;
  opponent_user_id: string;
  battle_prompt: string;
  challenger_argument: string;
  opponent_argument: string;
  status: string;
  winner_card_id: string | null;
  created_at: string;
  expires_at: string;
}

type AnyCard = MintedCard & {
  personality?: string | null;
  battle_record?: { wins: number; losses: number } | null;
};

interface CommunityCard {
  id: string;
  user_id: string;
  pixel_card_url: string;
  nickname: string;
  hp: number | null;
  flavor_text: string | null;
  minted_at: string;
  card_number: number | null;
  personality: string | null;
  battle_record: { wins: number; losses: number } | null;
  mod_count: number | null;
  username?: string;
}

interface BattleScreenProps {
  userCard: MintedCard;
  carLabel: string;
  initialWins: number;
  initialLosses: number;
  activeBattles: BattleChallenge[];
  pastBattles: BattleChallenge[];
  preselectedOpponent: MintedCard | null;
  userId: string;
  communityCards?: CommunityCard[];
}

// Maps a MintedCard to TradingCard props
function cardToProps(card: AnyCard, label: string) {
  const snap = card.car_snapshot ?? {};
  return {
    cardUrl: card.pixel_card_url,
    nickname: card.nickname,
    generatedAt: card.minted_at,
    hp: card.hp ?? null,
    modCount: card.mod_count ?? null,
    buildScore: (snap as { build_score?: number | null }).build_score ?? null,
    vinVerified: (snap as { vin_verified?: boolean }).vin_verified ?? false,
    cardNumber: card.card_number ?? null,
    flavorText: card.flavor_text ?? null,
    personality: card.personality ?? null,
    battleRecord: card.battle_record ?? null,
    carLabel: label,
  };
}

export function BattleScreen({
  userCard,
  carLabel,
  initialWins,
  initialLosses,
  activeBattles,
  pastBattles,
  preselectedOpponent,
  userId,
  communityCards = [],
}: BattleScreenProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uc = userCard as AnyCard;
  const oc = preselectedOpponent as AnyCard | null;

  const userProps = cardToProps(uc, carLabel);
  const oppProps = oc ? cardToProps(oc, `@${(oc as AnyCard & { username?: string }).username ?? "opponent"}`) : null;

  async function handleCallOut() {
    if (!preselectedOpponent || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/battles/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenger_card_id: userCard.id,
          opponent_card_id: preselectedOpponent.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send challenge");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Challenge failed");
    } finally {
      setSending(false);
    }
  }

  // ── Duel arena ──
  if (oppProps && !sent) {
    const userArchetype = safeArchetype(uc.personality);
    const userColors = ARCHETYPE_COLORS[userArchetype];
    const oppArchetype = safeArchetype(oc?.personality);
    const oppColors = ARCHETYPE_COLORS[oppArchetype];

    return (
      <div style={{ minHeight: "100dvh", background: "#0a0a0a", paddingBottom: 96 }}>
        {/* Arena header */}
        <div style={{ textAlign: "center", paddingTop: 40, paddingBottom: 12 }}>
          <p style={{
            fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 9, fontWeight: 900,
            letterSpacing: "0.28em", textTransform: "uppercase",
            color: "rgba(239,68,68,0.6)", marginBottom: 6,
          }}>
            Battle Arena
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
            Call Out
          </h1>
        </div>

        {/* Cards face-off */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 0, padding: "32px 16px 16px", flexWrap: "wrap",
        }}>
          {/* Your card */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <p style={{
              fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 8, fontWeight: 900,
              letterSpacing: "0.22em", textTransform: "uppercase", color: userColors.text, marginBottom: 4,
            }}>You</p>
            <TradingCard {...userProps} scale={0.9} idle interactive />
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <span style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 13, fontWeight: 900, color: "#22c55e" }}>{initialWins}W</span>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
              <span style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 13, fontWeight: 900, color: "#ef4444" }}>{initialLosses}L</span>
            </div>
          </div>

          {/* VS separator */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 20px", flexShrink: 0 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0.05) 70%)",
              border: "2px solid rgba(239,68,68,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 24px rgba(239,68,68,0.3)",
            }}>
              <Swords size={20} style={{ color: "#ef4444" }} />
            </div>
            <span style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", color: "rgba(239,68,68,0.5)" }}>VS</span>
          </div>

          {/* Opponent card */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <p style={{
              fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 8, fontWeight: 900,
              letterSpacing: "0.22em", textTransform: "uppercase", color: oppColors.text, marginBottom: 4,
            }}>Opponent</p>
            <TradingCard {...oppProps} scale={0.9} idle interactive />
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <span style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 13, fontWeight: 900, color: "#22c55e" }}>{(oc?.battle_record?.wins ?? 0)}W</span>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
              <span style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 13, fontWeight: 900, color: "#ef4444" }}>{(oc?.battle_record?.losses ?? 0)}L</span>
            </div>
          </div>
        </div>

        {/* Challenge section */}
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 20px 0" }}>
          {error && (
            <p style={{ textAlign: "center", color: "#ef4444", fontSize: 12, fontFamily: "var(--font-pixel), 'm6x11', monospace", marginBottom: 12 }}>
              {error}
            </p>
          )}
          <button
            onClick={handleCallOut}
            disabled={sending}
            style={{
              width: "100%", height: 52, borderRadius: 14,
              background: sending ? "rgba(239,68,68,0.15)" : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
              border: sending ? "1px solid rgba(239,68,68,0.3)" : "none",
              color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: "0.03em",
              cursor: sending ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: sending ? "none" : "0 8px 32px rgba(239,68,68,0.4)",
              transition: "opacity 150ms", fontFamily: "var(--font-pixel), 'm6x11', monospace",
            }}
          >
            <Swords size={17} />
            {sending ? "Sending challenge..." : "Call Out This Card"}
          </button>
          <p style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: "rgba(200,180,240,0.35)", fontFamily: "var(--font-pixel), 'm6x11', monospace", letterSpacing: "0.04em" }}>
            Claude generates a battle prompt. Community votes for 24 hours.
          </p>
        </div>

        {/* Battle history */}
        {(activeBattles.length > 0 || pastBattles.length > 0) && (
          <BattleHistory activeBattles={activeBattles} pastBattles={pastBattles} userId={userId} />
        )}
      </div>
    );
  }

  // ── Sent confirmation ──
  if (sent) {
    return (
      <div style={{
        minHeight: "100dvh", background: "#0a0a0a",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 20, padding: "0 24px 96px",
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 32px rgba(34,197,94,0.25)",
        }}>
          <CheckCircle2 size={28} style={{ color: "#22c55e" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Challenge sent!
          </h2>
          <p style={{ fontSize: 13, color: "rgba(200,180,240,0.5)", fontFamily: "var(--font-pixel), 'm6x11', monospace", lineHeight: 1.6, maxWidth: 320, textAlign: "center" }}>
            Claude is writing the battle prompt.<br />Check back to see the duel.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
          <TradingCard {...userProps} scale={0.65} idle={false} interactive={false} />
          <Swords size={24} style={{ color: "rgba(239,68,68,0.5)" }} />
          {oppProps && <TradingCard {...oppProps} scale={0.65} idle={false} interactive={false} />}
        </div>
      </div>
    );
  }

  // ── No opponent — your card + opponent browser + history ──
  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a", paddingBottom: 96 }}>
      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: 40, paddingBottom: 4 }}>
        <p style={{
          fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 9, fontWeight: 900,
          letterSpacing: "0.28em", textTransform: "uppercase",
          color: "rgba(200,180,240,0.4)", marginBottom: 6,
        }}>Battle</p>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
          Your Record
        </h1>
      </div>

      {/* Your card centered */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px 12px", gap: 12 }}>
        <TradingCard {...userProps} scale={1} idle interactive />
        <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 24, fontWeight: 900, color: "#22c55e", lineHeight: 1, margin: 0 }}>{initialWins}</p>
            <p style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 8, fontWeight: 700, color: "rgba(34,197,94,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4 }}>Wins</p>
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 24, fontWeight: 900, color: "#ef4444", lineHeight: 1, margin: 0 }}>{initialLosses}</p>
            <p style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 8, fontWeight: 700, color: "rgba(239,68,68,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4 }}>Losses</p>
          </div>
        </div>
      </div>

      {/* Opponent browser */}
      <OpponentBrowser cards={communityCards} />

      {/* Battle history */}
      <BattleHistory activeBattles={activeBattles} pastBattles={pastBattles} userId={userId} />
    </div>
  );
}

// ── Opponent Browser ───────────────────────────────────────────────────────────

function OpponentBrowser({ cards }: { cards: CommunityCard[] }) {
  const router = useRouter();

  return (
    <div style={{ maxWidth: 640, margin: "28px auto 0", padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Swords size={14} style={{ color: "rgba(239,68,68,0.7)" }} />
        <p style={{
          fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 8, fontWeight: 900,
          letterSpacing: "0.22em", textTransform: "uppercase",
          color: "rgba(239,68,68,0.6)", margin: 0,
        }}>
          Pick a fight
        </p>
      </div>

      {cards.length === 0 ? (
        <div style={{
          borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)", padding: "24px 20px",
          textAlign: "center",
        }}>
          <p style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 11, color: "rgba(200,180,240,0.3)", letterSpacing: "0.06em" }}>
            No other builders yet. Invite someone to battle.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cards.map((card) => {
            const archetype = safeArchetype(card.personality);
            const colors = ARCHETYPE_COLORS[archetype];
            const wins = card.battle_record?.wins ?? 0;
            const losses = card.battle_record?.losses ?? 0;

            return (
              <button
                key={card.id}
                onClick={() => router.push(`/battle?opponent=${card.id}`)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 14,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid rgba(255,255,255,0.07)`,
                  padding: "12px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 150ms, background 150ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${colors.border}`;
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                }}
              >
                {/* Card thumbnail */}
                <div style={{
                  width: 44, height: 44, borderRadius: 8, overflow: "hidden",
                  flexShrink: 0, border: `1.5px solid ${colors.border}`,
                  background: "#181926",
                  boxShadow: `0 0 8px ${colors.glow}`,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.pixel_card_url}
                    alt={card.nickname}
                    style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }}
                  />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: "0 0 2px",
                    fontFamily: "var(--font-pixel), 'm6x11', monospace",
                    fontSize: 12, fontWeight: 900,
                    color: "#fff", letterSpacing: "0.04em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {card.nickname}
                  </p>
                  <p style={{
                    margin: 0, fontSize: 10,
                    color: "rgba(200,180,240,0.4)",
                    fontFamily: "var(--font-pixel), 'm6x11', monospace",
                    letterSpacing: "0.06em",
                  }}>
                    @{card.username ?? "user"} · {archetype.replace("The ", "")}
                  </p>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 10, fontWeight: 900, color: colors.text, letterSpacing: "0.06em" }}>
                    {wins}W {losses}L
                  </span>
                  {card.hp && (
                    <span style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 9, color: "rgba(200,180,240,0.35)", letterSpacing: "0.06em" }}>
                      {card.hp} HP
                    </span>
                  )}
                </div>

                {/* Challenge indicator */}
                <div style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: 8,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Swords size={13} style={{ color: "#ef4444" }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Battle History ─────────────────────────────────────────────────────────────

function BattleHistory({
  activeBattles,
  pastBattles,
  userId,
}: {
  activeBattles: BattleChallenge[];
  pastBattles: BattleChallenge[];
  userId: string;
}) {
  if (activeBattles.length === 0 && pastBattles.length === 0) return null;

  return (
    <div style={{ maxWidth: 560, margin: "32px auto 0", padding: "0 20px" }}>
      {activeBattles.length > 0 && (
        <>
          <p style={{
            fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 8, fontWeight: 900,
            letterSpacing: "0.22em", textTransform: "uppercase",
            color: "rgba(251,191,36,0.6)", marginBottom: 12,
          }}>Active Battles</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeBattles.map((b) => (
              <BattleRow key={b.id} battle={b} userId={userId} />
            ))}
          </div>
        </>
      )}

      {pastBattles.length > 0 && (
        <div style={{ marginTop: activeBattles.length > 0 ? 28 : 0 }}>
          <p style={{
            fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 8, fontWeight: 900,
            letterSpacing: "0.22em", textTransform: "uppercase",
            color: "rgba(200,180,240,0.4)", marginBottom: 12,
          }}>Past Battles</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pastBattles.map((b) => (
              <BattleRow key={b.id} battle={b} userId={userId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BattleRow({ battle, userId }: { battle: BattleChallenge; userId: string }) {
  const [expanded, setExpanded] = useState(false);
  const isChallenger = battle.challenger_user_id === userId;
  const myCardId = isChallenger ? battle.challenger_card_id : battle.opponent_card_id;
  const won = battle.winner_card_id === myCardId;
  const isActive = battle.status === "active" || battle.status === "pending";
  const hoursLeft = Math.max(0, Math.round((new Date(battle.expires_at).getTime() - Date.now()) / 3600000));

  const statusColor = isActive ? "#FBBF24" : won ? "#22c55e" : "#ef4444";
  const borderColor = isActive ? "rgba(251,191,36,0.2)" : won ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.18)";

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      style={{
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${borderColor}`,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)"}
      onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: expanded ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isActive ? (
            <Clock size={12} style={{ color: "#FBBF24" }} />
          ) : won ? (
            <Trophy size={12} style={{ color: "#22c55e" }} />
          ) : (
            <Swords size={12} style={{ color: "#ef4444" }} />
          )}
          <span style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 11, fontWeight: 900, color: statusColor, letterSpacing: "0.04em" }}>
            {isActive ? `${hoursLeft}h remaining` : won ? "Victory" : "Defeat"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 9, color: "rgba(200,180,240,0.3)", letterSpacing: "0.06em" }}>
            {new Date(battle.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ color: "rgba(200,180,240,0.3)", transition: "transform 200ms", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div style={{ animation: "battleRowExpand 0.15s ease-out" }}>
          <p style={{
            margin: "0 0 10px",
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: 13, fontStyle: "italic",
            lineHeight: 1.55, color: "rgba(220,210,240,0.75)",
            borderLeft: `2px solid ${statusColor}40`,
            paddingLeft: 10,
          }}>
            &ldquo;{battle.battle_prompt}&rdquo;
          </p>
          {battle.challenger_argument && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 8, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(200,180,240,0.3)", marginBottom: 4 }}>
                {isChallenger ? "Your argument" : "Their argument"}
              </p>
              <p style={{ fontFamily: "ui-serif, Georgia, serif", fontSize: 11, color: "rgba(200,185,240,0.6)", lineHeight: 1.5, margin: 0 }}>
                {battle.challenger_argument}
              </p>
            </div>
          )}
          {battle.opponent_argument && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontFamily: "var(--font-pixel), 'm6x11', monospace", fontSize: 8, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(200,180,240,0.3)", marginBottom: 4 }}>
                {!isChallenger ? "Your argument" : "Their argument"}
              </p>
              <p style={{ fontFamily: "ui-serif, Georgia, serif", fontSize: 11, color: "rgba(200,185,240,0.6)", lineHeight: 1.5, margin: 0 }}>
                {battle.opponent_argument}
              </p>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes battleRowExpand { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  );
}
