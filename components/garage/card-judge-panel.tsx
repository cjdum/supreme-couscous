"use client";

import { useState } from "react";
import { Star, Flag, ShieldCheck, Swords, Sparkles, AlertTriangle } from "lucide-react";
import type { CardTrait } from "@/lib/supabase/types";

interface Battle {
  id: string;
  outcome: "win" | "loss" | "narrow_win" | "narrow_loss";
  challenger_card_id: string;
  opponent_card_id: string;
  created_at: string;
}

interface Props {
  cardId: string;
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

const DIMENSIONS = ["cleanliness", "creativity", "execution", "presence"] as const;
type Dimension = (typeof DIMENSIONS)[number];

export function CardJudgePanel(props: Props) {
  const [ratings, setRatings] = useState<Record<Dimension, number>>({
    cleanliness: 0,
    creativity: 0,
    execution: 0,
    presence: 0,
  });
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);
  const [signalMessage, setSignalMessage] = useState<string | null>(null);

  async function submitRating() {
    if (Object.values(ratings).some((v) => v < 1)) {
      setRatingMessage("Set all four dimensions");
      return;
    }
    setSubmittingRating(true);
    setRatingMessage(null);
    try {
      const res = await fetch("/api/ratings/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: props.cardId, ...ratings }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setRatingMessage(`Thanks — your rating counts at ${json.weighted.toFixed(2)}/5`);
    } catch (err) {
      setRatingMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmittingRating(false);
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
            <Star size={14} style={{ color: "#fbbf24" }} />
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#fbbf24" }}>Community rating</p>
          </div>
          <p className="text-xs font-mono" style={{ color: "rgba(200,180,240,0.6)" }}>
            {props.avgRating != null ? `${props.avgRating.toFixed(2)}/5 · ${props.ratingCount}` : "No ratings yet"}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {DIMENSIONS.map((dim) => (
            <div key={dim}>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(200,180,240,0.55)" }}>{dim}</p>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setRatings((r) => ({ ...r, [dim]: v }))}
                    aria-label={`${dim} ${v}`}
                    className="p-1"
                  >
                    <Star
                      size={14}
                      style={{
                        color: v <= (ratings[dim] ?? 0) ? "#fbbf24" : "rgba(200,180,240,0.3)",
                        fill: v <= (ratings[dim] ?? 0) ? "#fbbf24" : "transparent",
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={submitRating}
          disabled={submittingRating}
          className="h-9 px-4 rounded-xl text-[11px] font-bold border"
          style={{
            background: "rgba(168,85,247,0.15)",
            borderColor: "rgba(168,85,247,0.45)",
            color: "#e9d5ff",
          }}
        >
          Submit rating
        </button>
        {ratingMessage && (
          <p className="mt-2 text-[11px]" style={{ color: ratingMessage.startsWith("Thanks") ? "#30d158" : "#ff9f0a" }}>
            {ratingMessage}
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
        <div className="flex items-center gap-2 mb-3">
          <Swords size={14} style={{ color: "#ff453a" }} />
          <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "rgba(200,180,240,0.7)" }}>
            Battle record · {props.battleWins}W {props.battleLosses}L
          </p>
        </div>
        {props.battles.length === 0 ? (
          <p className="text-[11px] italic" style={{ color: "rgba(200,180,240,0.4)" }}>No battles yet.</p>
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
                    {won ? "WIN" : "LOSS"} · {b.outcome.replace("_", " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
