"use client";

import { useState } from "react";
import { X, Sparkles, Loader2, Check } from "lucide-react";
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

export function PreMintReviewModal({ payload, carLabel, onCancel, onConfirm }: Props) {
  const [title, setTitle] = useState(payload.cardTitle);
  const [submitting, setSubmitting] = useState(false);

  function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    onConfirm({ ...payload, cardTitle: title.trim() || payload.cardTitle });
  }

  const hp   = payload.estimatedPerformance.hp;
  const mods = payload.traits.filter((t) => t.earned).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm mint"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(3,3,10,0.88)",
        backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={submitting ? undefined : onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420,
          borderRadius: 22,
          background: "var(--mv-panel-bg-solid)",
          border: "1px solid var(--mv-panel-border-bright)",
          boxShadow: "0 0 40px rgba(123,79,212,0.2), 0 20px 60px rgba(0,0,0,0.8)",
          padding: "26px 22px 22px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h3 style={{
              fontFamily: "ui-monospace, monospace", fontSize: 14, fontWeight: 900,
              letterSpacing: "0.06em", textTransform: "uppercase",
              color: "var(--mv-panel-text)", margin: 0,
            }}>
              Ready to mint?
            </h3>
            <p style={{
              fontFamily: "ui-monospace, monospace", fontSize: 10,
              color: "var(--mv-panel-text-muted)", margin: "4px 0 0", letterSpacing: "0.04em",
            }}>
              {carLabel}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              width: 32, height: 32, borderRadius: 10, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: "transparent", border: "1px solid var(--mv-panel-border)",
              color: "var(--mv-panel-text-muted)", cursor: "pointer",
            }}
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>

        {/* Card title — the one thing worth editing */}
        <label style={{ display: "block", marginBottom: 20 }}>
          <span style={{
            fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--mv-panel-text-muted)", display: "block", marginBottom: 6,
          }}>
            Card name
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 60))}
            style={{
              width: "100%", padding: "11px 13px", borderRadius: 11,
              background: "var(--mv-panel-bg)", border: "1px solid var(--mv-panel-border-bright)",
              color: "var(--mv-panel-text)", fontFamily: "ui-monospace, monospace",
              fontSize: 14, fontWeight: 700, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </label>

        {/* Quick preview row */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8, marginBottom: 20,
        }}>
          {[
            { label: "HP", value: hp ? `${hp}` : "—" },
            { label: "Traits", value: `${mods}` },
            { label: "Archetype", value: payload.buildArchetype.split(" ")[0] },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: "10px 0", borderRadius: 12, textAlign: "center",
              background: "var(--mv-panel-bg)", border: "1px solid var(--mv-panel-border)",
            }}>
              <p style={{
                fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700,
                color: "var(--mv-panel-text-muted)", textTransform: "uppercase",
                letterSpacing: "0.12em", margin: "0 0 3px",
              }}>{label}</p>
              <p style={{
                fontFamily: "ui-monospace, monospace", fontSize: 14, fontWeight: 900,
                color: "var(--mv-panel-text)", margin: 0,
              }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Flavor text preview */}
        {payload.flavourText && (
          <div style={{
            marginBottom: 20, padding: "10px 14px", borderRadius: 12,
            background: "rgba(123,79,212,0.07)", border: "1px solid rgba(123,79,212,0.18)",
          }}>
            <p style={{
              fontSize: 13, fontStyle: "italic", lineHeight: 1.6,
              color: "rgba(220,210,245,0.85)", margin: 0,
            }}>
              &ldquo;{payload.flavourText}&rdquo;
            </p>
          </div>
        )}

        {/* Mint button */}
        <button
          onClick={handleConfirm}
          disabled={submitting || !title.trim()}
          style={{
            width: "100%", minHeight: 50, borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            background: submitting || !title.trim()
              ? "rgba(123,79,212,0.2)"
              : "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
            color: "white",
            border: "1px solid rgba(168,85,247,0.5)",
            boxShadow: !submitting && title.trim() ? "0 4px 20px rgba(123,79,212,0.4)" : "none",
            cursor: submitting || !title.trim() ? "not-allowed" : "pointer",
            transition: "all 150ms ease",
          }}
        >
          {submitting ? (
            <><Loader2 size={14} className="animate-spin" />Minting…</>
          ) : (
            <><Check size={14} />Mint it<Sparkles size={14} /></>
          )}
        </button>

        <p style={{
          textAlign: "center", marginTop: 10,
          fontFamily: "ui-monospace, monospace", fontSize: 9,
          color: "var(--mv-panel-text-muted)", letterSpacing: "0.04em",
        }}>
          This snapshot is permanent. You can mint again anytime.
        </p>
      </div>
    </div>
  );
}
