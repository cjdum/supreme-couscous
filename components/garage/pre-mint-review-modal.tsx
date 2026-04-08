"use client";

import { useState } from "react";
import { X, ShieldCheck, AlertTriangle, Sparkles, Loader2, Check, Pencil } from "lucide-react";
import type { EstimatedPerformance, CardTrait } from "@/lib/supabase/types";

export interface PreMintPayload {
  carId: string;
  occasion: string;
  isPublic: boolean;
  cardTitle: string;
  buildArchetype: string;
  estimatedPerformance: EstimatedPerformance;
  aiEstimatedPerformance: EstimatedPerformance;
  buildAggression: number;
  uniquenessScore: number;
  authenticityConfidence: number;
  traits: CardTrait[];
  flavourText: string;
  weaknesses: string[];
  rivalArchetypes: string[];
  stockSpecs: {
    hp: number | null;
    torque: number | null;
    zero_to_sixty: number | null;
    top_speed: number | null;
    weight: number | null;
    matched: boolean;
    exact: boolean;
  } | null;
  builderScore: {
    composite: number;
    tier: string;
  } | null;
}

interface Props {
  payload: PreMintPayload;
  carLabel: string;
  onCancel: () => void;
  onConfirm: (edited: PreMintPayload) => void;
}

/**
 * Pre-mint verification modal.
 *
 * Shows the user everything the AI generated + estimated so they can:
 *  - Edit the card title
 *  - Adjust performance stats (original AI values are pinned in aiEstimatedPerformance)
 *  - Review which traits were earned and WHY
 *
 * Users with Builder Score 800+ can skip this step. That is enforced at the
 * caller (see PixelCard).
 */
export function PreMintReviewModal({ payload, carLabel, onCancel, onConfirm }: Props) {
  const [title, setTitle] = useState(payload.cardTitle);
  const [hp, setHp] = useState<number>(payload.estimatedPerformance.hp);
  const [torque, setTorque] = useState<number>(payload.estimatedPerformance.torque);
  const [zero, setZero] = useState<number>(payload.estimatedPerformance.zero_to_sixty);
  const [topSpeed, setTopSpeed] = useState<number>(payload.estimatedPerformance.top_speed);
  const [submitting, setSubmitting] = useState(false);

  const earned = payload.traits.filter((t) => t.earned);
  const missed = payload.traits.filter((t) => !t.earned);

  async function handleConfirm() {
    setSubmitting(true);
    const edited: PreMintPayload = {
      ...payload,
      cardTitle: title.trim() || payload.cardTitle,
      estimatedPerformance: { hp, torque, zero_to_sixty: zero, top_speed: topSpeed },
    };
    onConfirm(edited);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pre-mint verification"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(3,3,10,0.92)",
        backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={submitting ? undefined : onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 640,
          maxHeight: "92dvh",
          overflowY: "auto",
          borderRadius: 20,
          background: "var(--mv-panel-bg-solid)",
          border: "1px solid var(--mv-panel-border-bright)",
          boxShadow: "0 0 40px rgba(123,79,212,0.2), 0 20px 60px rgba(0,0,0,0.8)",
          padding: "28px 24px 24px",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="mv-text" style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
              Review before minting
            </h3>
            <p className="mv-text-muted" style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.04em", margin: "4px 0 0" }}>
              {carLabel} · this card becomes permanent
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-[var(--mv-accent-tint)] transition-colors"
            aria-label="Cancel"
          >
            <X size={16} className="mv-text-muted" />
          </button>
        </div>

        {/* Title */}
        <label className="block mb-5">
          <span className="mv-text-muted" style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Card title
          </span>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 60))}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--mv-panel-bg)",
                border: "1px solid var(--mv-panel-border)",
                color: "var(--mv-panel-text)",
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                fontWeight: 700,
                outline: "none",
              }}
            />
            <Pencil size={12} className="mv-text-muted" />
          </div>
        </label>

        {/* Archetype */}
        <div className="mb-5">
          <span className="mv-text-muted" style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Build archetype
          </span>
          <div className="mt-1.5 px-3 py-2 rounded-lg inline-block" style={{ background: "var(--mv-accent-tint-strong)", border: "1px solid var(--mv-panel-border-bright)" }}>
            <span className="mv-text-accent" style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {payload.buildArchetype}
            </span>
          </div>
        </div>

        {/* Performance stats — editable */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="mv-text-muted" style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Performance (editable)
            </span>
            {payload.stockSpecs?.matched && (
              <span className="mv-text-dim" style={{ fontFamily: "ui-monospace, monospace", fontSize: 9 }}>
                stock: {payload.stockSpecs.hp}hp · {payload.stockSpecs.zero_to_sixty}s
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatInput label="HP" value={hp} onChange={setHp} min={50} max={3000} />
            <StatInput label="Torque" value={torque} onChange={setTorque} min={50} max={3000} />
            <StatInput label="0-60" value={zero} onChange={setZero} min={1.8} max={20} step={0.1} />
            <StatInput label="Top MPH" value={topSpeed} onChange={setTopSpeed} min={60} max={400} />
          </div>
          {!payload.stockSpecs?.matched && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg" style={{ background: "rgba(255,159,10,0.08)", border: "1px solid rgba(255,159,10,0.3)" }}>
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#ff9f0a" }} />
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: "#ff9f0a", margin: 0, lineHeight: 1.5 }}>
                Stock baseline not in our database — numbers are conservative estimates. Authenticity confidence was lowered to reflect this.
              </p>
            </div>
          )}
        </div>

        {/* Scores row */}
        <div className="mb-5 grid grid-cols-3 gap-2">
          <ScoreCell label="Aggression" value={`${payload.buildAggression}/10`} />
          <ScoreCell label="Uniqueness" value={`${payload.uniquenessScore}%`} />
          <ScoreCell label="Authenticity" value={`${payload.authenticityConfidence}%`} />
        </div>

        {/* Traits */}
        <div className="mb-5">
          <span className="mv-text-muted" style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Traits earned · {earned.length}/{payload.traits.length}
          </span>
          <div className="mt-2 space-y-1.5">
            {earned.map((t) => (
              <div key={t.id} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.3)" }}>
                <ShieldCheck size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#30d158" }} />
                <div className="min-w-0 flex-1">
                  <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 800, color: "#30d158", margin: 0, letterSpacing: "0.04em" }}>{t.label}</p>
                  <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: "rgba(48,209,88,0.7)", margin: "2px 0 0", lineHeight: 1.4 }}>{t.reason}</p>
                </div>
              </div>
            ))}
            {earned.length === 0 && (
              <p className="mv-text-dim" style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, fontStyle: "italic", margin: 0 }}>
                No traits earned on this card yet.
              </p>
            )}
            {missed.length > 0 && (
              <details className="mt-2">
                <summary className="mv-text-muted cursor-pointer" style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>
                  Show {missed.length} unearned traits
                </summary>
                <div className="mt-2 space-y-1">
                  {missed.map((t) => (
                    <div key={t.id} className="flex items-start gap-2 p-2 rounded-md" style={{ background: "var(--mv-panel-bg)", border: "1px solid var(--mv-panel-border)" }}>
                      <div className="min-w-0 flex-1">
                        <p className="mv-text-soft" style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 700, margin: 0 }}>{t.label}</p>
                        <p className="mv-text-dim" style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, margin: "2px 0 0" }}>{t.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Flavor text */}
        {payload.flavourText && (
          <div className="mb-5 p-3 rounded-lg" style={{ background: "var(--mv-panel-bg)", border: "1px solid var(--mv-panel-border)" }}>
            <p className="mv-text-soft" style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontStyle: "italic", margin: 0, lineHeight: 1.6 }}>
              &ldquo;{payload.flavourText}&rdquo;
            </p>
          </div>
        )}

        {/* Weaknesses */}
        {payload.weaknesses.length > 0 && (
          <div className="mb-5">
            <span className="mv-text-muted" style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Honest weak points
            </span>
            <ul className="mt-2 space-y-1">
              {payload.weaknesses.map((w, i) => (
                <li key={i} className="mv-text-soft" style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, lineHeight: 1.5 }}>
                  · {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={submitting || !title.trim()}
          className="w-full min-h-[48px] rounded-2xl flex items-center justify-center gap-2 text-sm font-bold"
          style={{
            background: submitting || !title.trim()
              ? "rgba(123,79,212,0.2)"
              : "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
            color: "white",
            border: "1px solid rgba(168,85,247,0.6)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            boxShadow: !submitting && title.trim() ? "0 4px 20px rgba(123,79,212,0.4)" : "none",
            cursor: submitting || !title.trim() ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Minting...
            </>
          ) : (
            <>
              <Check size={14} />
              Confirm & mint
              <Sparkles size={14} />
            </>
          )}
        </button>
        <p className="mv-text-dim text-center mt-2" style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: "0.04em" }}>
          Original AI estimate is logged separately for authenticity scoring.
        </p>
      </div>
    </div>
  );
}

function StatInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mv-text-dim" style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(n);
        }}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          background: "var(--mv-panel-bg)",
          border: "1px solid var(--mv-panel-border)",
          color: "var(--mv-panel-text)",
          fontFamily: "ui-monospace, monospace",
          fontSize: 13,
          fontWeight: 800,
          outline: "none",
          marginTop: 4,
          textAlign: "center",
        }}
      />
    </label>
  );
}

function ScoreCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl text-center" style={{ background: "var(--mv-panel-bg)", border: "1px solid var(--mv-panel-border)" }}>
      <p className="mv-text-dim" style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>
        {label}
      </p>
      <p className="mv-text" style={{ fontFamily: "ui-monospace, monospace", fontSize: 16, fontWeight: 900, margin: "4px 0 0" }}>
        {value}
      </p>
    </div>
  );
}
