"use client";

import { useState, useCallback } from "react";
import { ThumbsUp, ThumbsDown, Flag, ShieldCheck, Swords, Sparkles, AlertTriangle, Loader2, Trophy, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CardTrait } from "@/lib/supabase/types";

interface Battle {
  id: string;
  outcome: "win" | "loss" | "narrow_win" | "narrow_loss";
  challenger_card_id: string;
  opponent_card_id: string;
  created_at: string;
  opponent_label?: string | null;
}

interface MyCard {
  id: string;
  nickname: string;
  card_title: string | null;
  pixel_card_url: string;
  car_snapshot: { year: number; make: string; model: string };
}

interface Props {
  cardId: string;
  cardOwnerId: string;
  viewerUserId: string | null;
  cardTitle: string;
  archetype: string | null;
  authenticityConfidence: number | null;
  uniquenessScore: number | null;
  buildAggression: number | null;
  traits: CardTrait[];
  weaknesses: string[];
  avgRating: number | null;
  ratingCount: number;
  endorseWeight: number;
  flagWeight: number;
  battleWins: number;
  battleLosses: number;
  battles: Battle[];
}

export function CardJudgePanel(props: Props) {
  const [voteState, setVoteState] = useState<"up" | "down" | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const [signalMessage, setSignalMessage] = useState<string | null>(null);

  // Challenge state
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [myCards, setMyCards] = useState<MyCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [battleResult, setBattleResult] = useState<{ outcome: string; scoreC: number; scoreO: number } | null>(null);
  const [battleError, setBattleError] = useState<string | null>(null);

  const isOwner = props.viewerUserId === props.cardOwnerId;
  const canChallenge = !!props.viewerUserId && !isOwner;

  // Compute upvote/downvote counts from avgRating and ratingCount
  const upvoteRatio = props.avgRating != null ? (props.avgRating - 1) / 4 : 0.5; // maps 1→0, 5→1
  const upvotes = Math.round(props.ratingCount * upvoteRatio);
  const downvotes = props.ratingCount - upvotes;

  const loadMyCards = useCallback(async () => {
    if (myCards.length) return;
    setCardsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("pixel_cards")
      .select("id, nickname, card_title, pixel_card_url, car_snapshot")
      .eq("user_id", props.viewerUserId!)
      .order("minted_at", { ascending: false })
      .limit(20);
    setMyCards((data ?? []) as unknown as MyCard[]);
    setCardsLoading(false);
  }, [myCards.length, props.viewerUserId]);

  async function handleOpenChallenge() {
    setChallengeOpen(true);
    setBattleResult(null);
    setBattleError(null);
    setSelectedCardId(null);
    loadMyCards();
  }

  async function handleChallenge() {
    if (!selectedCardId || challenging) return;
    setChallenging(true);
    setBattleError(null);
    try {
      const res = await fetch("/api/battles/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenger_card_id: selectedCardId, opponent_card_id: props.cardId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setBattleResult({
        outcome: json.outcome,
        scoreC: json.breakdown.challenger,
        scoreO: json.breakdown.opponent,
      });
    } catch (err) {
      setBattleError(err instanceof Error ? err.message : "Battle failed");
    } finally {
      setChallenging(false);
    }
  }

  async function submitVote(vote: "up" | "down") {
    if (isOwner || voting) return;
    setVoting(true);
    setVoteMessage(null);
    const score = vote === "up" ? 5 : 1;
    try {
      const res = await fetch("/api/ratings/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: props.cardId,
          cleanliness: score,
          creativity: score,
          execution: score,
          presence: score,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setVoteState(vote);
      setVoteMessage(vote === "up" ? "Upvoted!" : "Downvoted.");
    } catch (err) {
      setVoteMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setVoting(false);
    }
  }

  async function sendSignal(signal_type: "flag" | "endorse") {
    setSignalMessage(null);
    try {
      const res = await fetch("/api/credibility/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: props.cardId, signal_type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setSignalMessage(
        signal_type === "endorse"
          ? `Endorsed — authenticity confidence is now ${json.authenticity_confidence}`
          : `Flagged — your signal was logged (weight ${json.weight.toFixed(2)})`,
      );
    } catch (err) {
      setSignalMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  const earned = props.traits.filter((t) => t.earned);
  const missed = props.traits.filter((t) => !t.earned);

  return (
    <section className="mt-6 space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {props.archetype && (
          <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.12em]" style={{ background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.45)", color: "#e9d5ff" }}>
            {props.archetype}
          </span>
        )}
        {props.authenticityConfidence != null && (
          <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.12em]" style={{ background: "rgba(48,209,88,0.10)", border: "1px solid rgba(48,209,88,0.35)", color: "#30d158" }}>
            Authenticity {props.authenticityConfidence}%
          </span>
        )}
        {props.uniquenessScore != null && (
          <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.12em]" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)", color: "#60a5fa" }}>
            Unique {props.uniquenessScore}%
          </span>
        )}
        {props.buildAggression != null && (
          <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.12em]" style={{ background: "rgba(255,69,58,0.10)", border: "1px solid rgba(255,69,58,0.35)", color: "#ff453a" }}>
            Aggression {props.buildAggression}/10
          </span>
        )}
      </div>

      {/* Community rating */}
      <div className="p-4 rounded-2xl" style={{ background: "rgba(15,12,30,0.6)", border: "1px solid rgba(168,85,247,0.22)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ThumbsUp size={14} style={{ color: "#30d158" }} />
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "rgba(200,180,240,0.7)" }}>Community rating</p>
          </div>
          <p className="text-xs font-mono" style={{ color: "rgba(200,180,240,0.6)" }}>
            {props.ratingCount > 0 ? `${props.ratingCount} vote${props.ratingCount !== 1 ? "s" : ""}` : "No votes yet"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Upvote button */}
          <button
            onClick={() => submitVote("up")}
            disabled={voting || isOwner || voteState !== null}
            className="flex items-center gap-2 h-12 px-5 rounded-xl text-[13px] font-bold border transition-all disabled:opacity-50"
            style={{
              background: voteState === "up" ? "rgba(48,209,88,0.2)" : "rgba(48,209,88,0.08)",
              borderColor: voteState === "up" ? "rgba(48,209,88,0.7)" : "rgba(48,209,88,0.3)",
              color: voteState === "up" ? "#30d158" : "rgba(48,209,88,0.75)",
              boxShadow: voteState === "up" ? "0 0 12px rgba(48,209,88,0.25)" : "none",
            }}
          >
            <ThumbsUp size={16} style={{ fill: voteState === "up" ? "#30d158" : "transparent" }} />
            <span className="font-mono">{upvotes}</span>
          </button>

          {/* Downvote button */}
          <button
            onClick={() => submitVote("down")}
            disabled={voting || isOwner || voteState !== null}
            className="flex items-center gap-2 h-12 px-5 rounded-xl text-[13px] font-bold border transition-all disabled:opacity-50"
            style={{
              background: voteState === "down" ? "rgba(255,69,58,0.18)" : "rgba(255,69,58,0.06)",
              borderColor: voteState === "down" ? "rgba(255,69,58,0.7)" : "rgba(255,69,58,0.28)",
              color: voteState === "down" ? "#ff453a" : "rgba(255,69,58,0.65)",
              boxShadow: voteState === "down" ? "0 0 12px rgba(255,69,58,0.2)" : "none",
            }}
          >
            <ThumbsDown size={16} style={{ fill: voteState === "down" ? "#ff453a" : "transparent" }} />
            <span className="font-mono">{downvotes}</span>
          </button>

          {voting && <Loader2 size={14} className="animate-spin" style={{ color: "rgba(200,180,240,0.5)" }} />}
        </div>
        {isOwner && (
          <p className="mt-2 text-[10px]" style={{ color: "rgba(200,180,240,0.4)" }}>
            You cannot vote on your own card.
          </p>
        )}
        {voteMessage && (
          <p className="mt-2 text-[11px]" style={{ color: voteMessage === "Upvoted!" ? "#30d158" : voteMessage === "Downvoted." ? "#ff9f0a" : "#ff453a" }}>
            {voteMessage}
          </p>
        )}
      </div>

      {/* Traits */}
      <div className="p-4 rounded-2xl" style={{ background: "rgba(15,12,30,0.6)", border: "1px solid rgba(168,85,247,0.22)" }}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={14} style={{ color: "#30d158" }} />
          <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "rgba(200,180,240,0.7)" }}>
            Traits · {earned.length}/{props.traits.length}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {earned.map((t) => (
            <div key={t.id} className="p-2.5 rounded-lg" style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.3)" }}>
              <p className="text-[11px] font-black" style={{ color: "#30d158" }}>{t.label}</p>
              <p className="text-[9px] mt-0.5" style={{ color: "rgba(48,209,88,0.75)", lineHeight: 1.5 }}>{t.reason}</p>
            </div>
          ))}
          {earned.length === 0 && props.traits.length === 0 && (
            <p className="text-[11px] italic" style={{ color: "rgba(200,180,240,0.4)" }}>No trait data on this card.</p>
          )}
        </div>
        {missed.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(200,180,240,0.55)" }}>
              Show {missed.length} unearned
            </summary>
            <div className="mt-2 space-y-1.5">
              {missed.map((t) => (
                <div key={t.id} className="p-2 rounded-md" style={{ background: "rgba(15,12,30,0.6)", border: "1px solid rgba(168,85,247,0.15)" }}>
                  <p className="text-[11px] font-bold" style={{ color: "rgba(220,210,250,0.8)" }}>{t.label}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(200,180,240,0.5)", lineHeight: 1.5 }}>{t.reason}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Weaknesses */}
      {props.weaknesses.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ background: "rgba(255,159,10,0.06)", border: "1px solid rgba(255,159,10,0.25)" }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: "#ff9f0a" }} />
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#ff9f0a" }}>
              Honest weak points
            </p>
          </div>
          <ul className="space-y-1">
            {props.weaknesses.map((w, i) => (
              <li key={i} className="text-[12px]" style={{ color: "rgba(255,200,120,0.85)", lineHeight: 1.6 }}>
                · {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Credibility signals */}
      <div className="p-4 rounded-2xl" style={{ background: "rgba(15,12,30,0.6)", border: "1px solid rgba(168,85,247,0.22)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: "#a855f7" }} />
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "rgba(200,180,240,0.7)" }}>Credibility</p>
          </div>
          <p className="text-xs font-mono" style={{ color: "rgba(200,180,240,0.6)" }}>
            endorse {props.endorseWeight.toFixed(1)} · flag {props.flagWeight.toFixed(1)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => sendSignal("endorse")}
            className="flex-1 h-10 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-2"
            style={{ background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.35)", color: "#30d158" }}
          >
            <ShieldCheck size={12} /> Endorse as credible
          </button>
          <button
            onClick={() => sendSignal("flag")}
            className="flex-1 h-10 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-2"
            style={{ background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.3)", color: "#ff453a" }}
          >
            <Flag size={12} /> Flag as unbelievable
          </button>
        </div>
        {signalMessage && (
          <p className="mt-2 text-[11px]" style={{ color: signalMessage.startsWith("Endorsed") || signalMessage.startsWith("Flagged") ? "#30d158" : "#ff9f0a" }}>
            {signalMessage}
          </p>
        )}
      </div>

      {/* Battles */}
      <div className="p-4 rounded-2xl" style={{ background: "rgba(15,12,30,0.6)", border: "1px solid rgba(168,85,247,0.22)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Swords size={14} style={{ color: "#ff453a" }} />
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "rgba(200,180,240,0.7)" }}>
              Battles · {props.battleWins}W {props.battleLosses}L
            </p>
          </div>
          {canChallenge && !challengeOpen && !battleResult && (
            <button
              onClick={handleOpenChallenge}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] cursor-pointer transition-all"
              style={{
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
                color: "#ff453a",
              }}
            >
              <Swords size={11} /> Challenge
            </button>
          )}
        </div>

        {/* Challenge picker */}
        {challengeOpen && !battleResult && (
          <div style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(200,180,240,0.5)" }}>
                Pick your card
              </p>
              <button onClick={() => setChallengeOpen(false)} style={{ color: "rgba(200,180,240,0.4)", cursor: "pointer", background: "none", border: "none" }}>
                <X size={13} />
              </button>
            </div>
            {cardsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={18} style={{ color: "rgba(200,180,240,0.4)", animation: "spin 1s linear infinite" }} />
              </div>
            ) : myCards.length === 0 ? (
              <p className="text-[11px] italic" style={{ color: "rgba(200,180,240,0.4)" }}>
                You need a minted card to battle.
              </p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {myCards.map((c) => {
                  const label = c.card_title ?? c.nickname;
                  const sublabel = `${c.car_snapshot.year} ${c.car_snapshot.make} ${c.car_snapshot.model}`;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCardId(c.id)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left cursor-pointer transition-all"
                      style={{
                        background: selectedCardId === c.id ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${selectedCardId === c.id ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.pixel_card_url} alt={label} style={{ width: 28, height: 38, borderRadius: 3, objectFit: "cover", flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(230,220,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
                        <p style={{ fontSize: 9, color: "rgba(200,180,240,0.45)", marginTop: 1 }}>{sublabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {battleError && (
              <p className="text-[11px] mb-2" style={{ color: "#ff453a" }}>{battleError}</p>
            )}
            <button
              onClick={handleChallenge}
              disabled={!selectedCardId || challenging}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] cursor-pointer transition-all disabled:opacity-40"
              style={{
                background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.45)",
                color: "#ff453a",
              }}
            >
              {challenging ? <Loader2 size={13} className="animate-spin" /> : <Swords size={13} />}
              {challenging ? "Battling…" : "Fight!"}
            </button>
          </div>
        )}

        {/* Battle result */}
        {battleResult && (
          <div
            className="mb-3 p-3 rounded-xl text-center"
            style={{
              background: battleResult.outcome.startsWith("win") ? "rgba(48,209,88,0.08)" : "rgba(255,69,58,0.08)",
              border: `1px solid ${battleResult.outcome.startsWith("win") ? "rgba(48,209,88,0.3)" : "rgba(255,69,58,0.3)"}`,
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy size={14} style={{ color: battleResult.outcome.startsWith("win") ? "#30d158" : "#ff453a" }} />
              <p style={{ fontSize: 13, fontWeight: 900, color: battleResult.outcome.startsWith("win") ? "#30d158" : "#ff453a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {battleResult.outcome.replace("_", " ")}
              </p>
            </div>
            <p style={{ fontSize: 10, color: "rgba(200,180,240,0.6)", fontFamily: "ui-monospace, monospace" }}>
              {battleResult.scoreC.toFixed(1)} vs {battleResult.scoreO.toFixed(1)}
            </p>
            <button
              onClick={() => { setBattleResult(null); setChallengeOpen(false); }}
              className="mt-2 text-[10px] cursor-pointer"
              style={{ color: "rgba(200,180,240,0.4)", background: "none", border: "none" }}
            >
              dismiss
            </button>
          </div>
        )}

        {props.battles.length === 0 && !challengeOpen && !battleResult ? (
          <p className="text-[11px] italic" style={{ color: "rgba(200,180,240,0.4)" }}>
            {canChallenge ? "No battles yet — challenge this card!" : "No battles yet."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {props.battles.map((b) => {
              const isChallenger = b.challenger_card_id === props.cardId;
              const won = (b.outcome === "win" || b.outcome === "narrow_win") === isChallenger;
              return (
                <li key={b.id} className="flex items-center justify-between text-[11px] font-mono">
                  <span style={{ color: "rgba(200,180,240,0.6)" }}>
                    {new Date(b.created_at).toLocaleDateString()}
                  </span>
                  <span style={{ color: won ? "#30d158" : "#ff453a", fontWeight: 900 }}>
                    {won ? "W" : "L"} vs {b.opponent_label ?? "Unknown"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
