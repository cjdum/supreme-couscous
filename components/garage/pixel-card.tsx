"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Sparkles, Camera, CheckCircle2, ArrowRight, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import type { CardEligibility, MintedCard } from "@/lib/pixel-card";
import type { EstimatedPerformance, CardTrait } from "@/lib/supabase/types";
import { CARD_BORDER_COLOR } from "@/lib/pixel-card";
import { TradingCard } from "./trading-card";
import { CardRevealCeremony } from "./card-reveal-ceremony";

interface MintPayload {
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
}

interface PixelCardProps {
  carId: string;
  carLabel: string;
  /** Latest minted card for this car (or null) */
  latestCard: MintedCard | null;
  /** Total card count for this car (for "Edition" indicator) */
  cardCount: number;
  /** If missing, mint is blocked with a clear message */
  trim?: string | null;
  color?: string | null;
  /** When true, auto-opens the mint flow on first render (used from /mint page) */
  autoMint?: boolean;
}

// Simplified mint flow: idle → occasion → summoning (generate+mint chained) → ceremony
type MintState = "idle" | "occasion" | "summoning" | "ceremony";

const OCCASION_EXAMPLES = [
  "The day she finally felt mine",
  "Bringing her back from the dead",
  "First time I trusted her",
  "Survived the rebuild",
  "She earned her name today",
  "Right before everything changed",
];

export function PixelCard(props: PixelCardProps) {
  const router = useRouter();
  const [mintState, setMintState] = useState<MintState>("idle");
  const [occasionInput, setOccasionInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshCard, setFreshCard] = useState<MintedCard | null>(null);
  const [eligibility, setEligibility] = useState<CardEligibility | null>(null);
  const [eligLoading, setEligLoading] = useState(true);
  const [summonStep, setSummonStep] = useState<"conjuring" | "painting" | "binding">("conjuring");

  // Only a real photo is required to mint — trim/color are optional (used for better pixel art).
  const hasTrim  = !!props.trim?.trim();
  const hasColor = !!props.color?.trim();
  const needsProfile = false; // no longer block minting on trim/color

  // ── Fetch eligibility (initial + polling fallback every 10s) ────────────
  const fetchEligibility = useCallback(async () => {
    try {
      const res = await fetch(`/api/cards/eligibility?carId=${props.carId}`);
      if (res.ok) {
        const data: CardEligibility = await res.json();
        setEligibility(data);
      }
    } catch {
      /* swallow — keep last value */
    } finally {
      setEligLoading(false);
    }
  }, [props.carId]);

  useEffect(() => {
    fetchEligibility();
    const interval = setInterval(fetchEligibility, 10_000);
    return () => clearInterval(interval);
  }, [fetchEligibility]);

  // Auto-open mint flow when ?action=mint is in the URL (from /mint picker page)
  const autoMintFiredRef = useRef(false);
  useEffect(() => {
    if (!props.autoMint) return;
    if (autoMintFiredRef.current) return;
    if (eligLoading) return;         // wait until we know eligibility
    autoMintFiredRef.current = true;
    setOccasionInput("");
    setError(null);
    setMintState("occasion");
  }, [props.autoMint, eligLoading, eligibility]);

  // ── Ceremony overlay (freshly minted) ───────────────────────────────────
  if (mintState === "ceremony" && freshCard) {
    const snap = freshCard.car_snapshot;
    return (
      <CardRevealCeremony
        card={{
          cardUrl:        freshCard.pixel_card_url,
          nickname:       freshCard.nickname,
          generatedAt:    freshCard.minted_at,
          hp:             freshCard.hp,
          modCount:       freshCard.mod_count,
          buildScore:     snap.build_score,
          vinVerified:    snap.vin_verified,
          cardNumber:     freshCard.card_number,
          era:            freshCard.era,
          flavorText:     freshCard.flavor_text,
          occasion:       freshCard.occasion,
          mods:           snap.mods ?? [],
          modsDetail:     snap.mods_detail ?? undefined,
          torque:         snap.torque ?? null,
          zeroToSixty:    snap.zero_to_sixty ?? null,
          totalInvested:  snap.total_invested ?? null,
          edition:        props.cardCount + 1,
        }}
        carLabel={props.carLabel}
        onComplete={() => {
          setMintState("idle");
          router.refresh();
        }}
      />
    );
  }

  async function handleMint() {
    if (mintState !== "idle") return;
    if (!eligibility?.eligible) return;
    // Open occasion modal
    setOccasionInput("");
    setError(null);
    setMintState("occasion");
  }

  async function handleConfirmOccasion() {
    const occasion = occasionInput.trim();
    if (!occasion) {
      setError("Occasion is required");
      return;
    }
    if (occasion.length > 100) {
      setError("Max 100 characters");
      return;
    }

    // No review form — chain generate → mint directly behind the summoning overlay.
    setMintState("summoning");
    setSummonStep("conjuring");
    setError(null);

    try {
      // Step 1: AI generates stats + flavor text (no persistence yet).
      const genRes = await fetch(`/api/cards/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: props.carId, occasion }),
      });
      const genJson = await genRes.json().catch(() => ({}));
      if (!genRes.ok) {
        throw new Error(typeof genJson.error === "string" ? genJson.error : "Failed to conjure");
      }

      // Step 2: Commit the mint (pixel art generation + DB row).
      setSummonStep("painting");
      const mintPayload: MintPayload = {
        carId: props.carId,
        occasion,
        isPublic,
        cardTitle: String(genJson.cardTitle ?? ""),
        buildArchetype: String(genJson.buildArchetype ?? "Daily Driven"),
        estimatedPerformance: genJson.estimatedPerformance,
        aiEstimatedPerformance: genJson.aiEstimatedPerformance,
        buildAggression: Number(genJson.buildAggression ?? 5),
        uniquenessScore: Number(genJson.uniquenessScore ?? 50),
        authenticityConfidence: Number(genJson.authenticityConfidence ?? 60),
        traits: Array.isArray(genJson.traits) ? genJson.traits : [],
        flavourText: String(genJson.flavourText ?? ""),
        weaknesses: Array.isArray(genJson.weaknesses) ? genJson.weaknesses : [],
        rivalArchetypes: Array.isArray(genJson.rivalArchetypes) ? genJson.rivalArchetypes : [],
      };

      const mintRes = await fetch(`/api/cards/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mintPayload),
      });
      const mintJson = await mintRes.json().catch(() => ({}));
      if (!mintRes.ok) {
        throw new Error(typeof mintJson.error === "string" ? mintJson.error : "Failed to bind");
      }

      setSummonStep("binding");
      setFreshCard(mintJson.card as MintedCard);
      haptic("success");
      // Small hold on "binding" so the last step is visible before ceremony takes over.
      setTimeout(() => setMintState("ceremony"), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mint");
      haptic("heavy");
      setMintState("idle");
    }
  }

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (eligLoading && !eligibility) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] animate-pulse" />
          <div className="space-y-1">
            <div className="h-3 w-28 rounded bg-[var(--color-bg-elevated)] animate-pulse" />
            <div className="h-2 w-40 rounded bg-[var(--color-bg-elevated)] animate-pulse" />
          </div>
        </div>
        <div className="rounded-2xl bg-[var(--color-bg-elevated)] animate-pulse mx-auto" style={{ width: 260, height: 180 }} />
      </div>
    );
  }

  const eligible = eligibility?.eligible ?? false;
  const hasPhoto = eligibility?.hasPhoto ?? false;
  const hasCard  = !!props.latestCard;

  return (
    <div>
      {/* ── Summoning overlay (generate + mint chained, no review form) ───── */}
      {mintState === "summoning" && (
        <SummoningOverlay step={summonStep} />
      )}

      {/* ── Occasion modal ─────────────────────────────────────────────────── */}
      {mintState === "occasion" && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9998,
            background: "rgba(3,3,10,0.92)",
            backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
            animation: "pcOccFadeIn 0.18s ease-out",
          }}
          onClick={() => { setMintState("idle"); }}
        >
          <style>{`@keyframes pcOccFadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420,
              borderRadius: 20,
              background: "rgba(12,10,22,0.98)",
              border: "1px solid rgba(123,79,212,0.35)",
              boxShadow: "0 0 40px rgba(123,79,212,0.2), 0 20px 60px rgba(0,0,0,0.8)",
              padding: "28px 24px 24px",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h3 style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, fontWeight: 900, color: "rgba(240,230,255,0.95)", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
                Why bring her to life?
              </h3>
              <button
                onClick={() => setMintState("idle")}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(200,180,240,0.4)", padding: 4, display: "flex" }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(160,140,200,0.55)", letterSpacing: "0.06em", marginBottom: 18, lineHeight: 1.5 }}>
              This becomes her first memory — the spark that shapes who she is. She&rsquo;ll carry it until the day she&rsquo;s burned.
            </p>

            {/* Input */}
            <textarea
              value={occasionInput}
              onChange={(e) => {
                setOccasionInput(e.target.value.slice(0, 100));
                setError(null);
              }}
              placeholder='e.g. "The day she finally felt mine"'
              autoFocus
              rows={2}
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleConfirmOccasion();
                }
              }}
              style={{
                width: "100%", borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${error ? "rgba(255,69,58,0.5)" : "rgba(123,79,212,0.4)"}`,
                color: "rgba(240,230,255,0.9)",
                fontFamily: "ui-monospace, monospace", fontSize: 13,
                padding: "12px 14px", resize: "none",
                outline: "none", lineHeight: 1.5,
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
            />

            {/* Char counter + error */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              {error ? (
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(255,69,58,0.9)" }}>{error}</span>
              ) : (
                <span />
              )}
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: occasionInput.length >= 90 ? "rgba(255,149,0,0.8)" : "rgba(160,140,200,0.35)", letterSpacing: "0.06em" }}>
                {occasionInput.length}/100
              </span>
            </div>

            {/* Example chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14, marginBottom: 20 }}>
              {OCCASION_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setOccasionInput(ex); setError(null); }}
                  style={{
                    padding: "4px 10px", borderRadius: 20,
                    background: "rgba(123,79,212,0.1)",
                    border: "1px solid rgba(123,79,212,0.25)",
                    color: "rgba(200,180,240,0.7)",
                    fontFamily: "ui-monospace, monospace", fontSize: 9,
                    cursor: "pointer", letterSpacing: "0.06em",
                    transition: "all 0.15s",
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Public toggle */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: 12, marginBottom: 14,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(123,79,212,0.18)",
            }}>
              <div>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 700, color: "rgba(240,230,255,0.85)", letterSpacing: "0.08em", margin: 0 }}>
                  Share in community feed?
                </p>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, color: "rgba(160,140,200,0.5)", letterSpacing: "0.04em", margin: "2px 0 0" }}>
                  {isPublic ? "Visible to everyone in Community" : "Private — only you can see it"}
                </p>
              </div>
              <button
                onClick={() => setIsPublic((v) => !v)}
                style={{
                  width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                  background: isPublic ? "rgba(123,79,212,0.75)" : "rgba(255,255,255,0.1)",
                  border: `1px solid ${isPublic ? "rgba(168,85,247,0.6)" : "rgba(255,255,255,0.15)"}`,
                  position: "relative", cursor: "pointer", transition: "all 0.2s",
                  padding: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, transition: "left 0.2s",
                  left: isPublic ? 22 : 2,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                }} />
              </button>
            </div>

            {/* Mint button */}
            <button
              onClick={handleConfirmOccasion}
              disabled={!occasionInput.trim()}
              style={{
                width: "100%", height: 48, borderRadius: 14,
                background: occasionInput.trim()
                  ? "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)"
                  : "rgba(123,79,212,0.18)",
                border: `1px solid ${occasionInput.trim() ? "rgba(123,79,212,0.6)" : "rgba(123,79,212,0.25)"}`,
                color: occasionInput.trim() ? "white" : "rgba(255,255,255,0.35)",
                fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: occasionInput.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: occasionInput.trim() ? "0 4px 20px rgba(123,79,212,0.4)" : "none",
                transition: "all 0.2s",
              }}
            >
              <Sparkles size={14} />
              Mint card
              <ArrowRight size={14} />
            </button>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: "rgba(160,140,200,0.35)", textAlign: "center", marginTop: 10, letterSpacing: "0.06em" }}>
              Takes 20–40 seconds · AI generates art + flavor text
            </p>
          </div>
        </div>
      )}

      {/* ── Section label ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
          {eligible ? (
            <Unlock size={12} className="text-[#7b4fd4]" />
          ) : (
            <Lock size={12} className="text-[var(--color-text-muted)]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">
            {hasCard ? `Pixel cards · ${props.cardCount}` : eligible ? "Ready to mint" : "Pixel card locked"}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {hasCard
              ? "Mint another to capture this moment"
              : eligible
              ? "Your first card is waiting"
              : "Add a photo to unlock"}
          </p>
        </div>
      </div>

      {/* ── Latest card preview (if any) ───────────────────────────────────── */}
      {hasCard && props.latestCard && (
        <div className="mb-4 flex justify-center">
          <TradingCard
            cardUrl={props.latestCard.pixel_card_url}
            nickname={props.latestCard.nickname}
            generatedAt={props.latestCard.minted_at}
            hp={props.latestCard.hp}
            modCount={props.latestCard.mod_count}
            buildScore={props.latestCard.car_snapshot.build_score}
            vinVerified={props.latestCard.car_snapshot.vin_verified}
            cardNumber={props.latestCard.card_number}
            era={props.latestCard.era}
            flavorText={props.latestCard.flavor_text}
            occasion={props.latestCard.occasion}
            mods={props.latestCard.car_snapshot.mods ?? []}
            modsDetail={props.latestCard.car_snapshot.mods_detail}
            torque={props.latestCard.car_snapshot.torque ?? null}
            zeroToSixty={props.latestCard.car_snapshot.zero_to_sixty ?? null}
            totalInvested={props.latestCard.car_snapshot.total_invested ?? null}
            edition={props.cardCount > 1 ? props.cardCount : null}
            carLabel={props.carLabel}
            idle
            interactive
          />
        </div>
      )}

      {/* ── Locked silhouette (only when no card yet) ──────────────────────── */}
      {!hasCard && (
        <div
          className="rounded-2xl overflow-hidden relative mx-auto"
          style={{
            width: 260, height: 180,
            background: eligible
              ? "linear-gradient(135deg, #1a0a2e 0%, #0d0d1a 100%)"
              : "linear-gradient(135deg, #0d0d18 0%, #0a0a12 100%)",
            border: `2px solid ${eligible ? CARD_BORDER_COLOR : "rgba(61,61,92,0.8)"}`,
            boxShadow: eligible ? "0 0 24px rgba(123,79,212,0.30)" : "none",
            transition: "all 0.5s ease",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: [
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)",
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)",
            ].join(", "),
            pointerEvents: "none",
          }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            {eligible ? (
              <>
                <div className="rounded-full flex items-center justify-center" style={{ width: 44, height: 44, background: "rgba(123,79,212,0.2)", border: "2px solid rgba(123,79,212,0.5)" }}>
                  <Sparkles size={20} style={{ color: CARD_BORDER_COLOR }} />
                </div>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: CARD_BORDER_COLOR, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  Ready
                </p>
              </>
            ) : (
              <>
                <div className="rounded-full flex items-center justify-center" style={{ width: 44, height: 44, background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.1)" }}>
                  <Lock size={20} className="text-[var(--color-text-muted)]" />
                </div>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em" }}>
                  Locked
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Only gate: real photo ─────────────────────────────────────────── */}
      {!hasPhoto && (
        <div className="mt-4">
          <RequirementRow
            met={false}
            icon={<Camera size={13} />}
            label="Upload a real photo to unlock minting"
            detail="Required"
          />
        </div>
      )}

      {/* ── Error message ──────────────────────────────────────────────────── */}
      {error && mintState === "idle" && (
        <div
          role="alert"
          className="mt-3 rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-3.5 py-2.5 text-[11px] text-[var(--color-danger)]"
        >
          {error}
        </div>
      )}

      {/* ── Mint button ────────────────────────────────────────────────────── */}
      <div className="mt-4">
        <button
          onClick={handleMint}
          disabled={!eligible || mintState !== "idle"}
          style={{
            width: "100%", height: 44, borderRadius: 12,
            background: eligible && mintState === "idle"
              ? "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)"
              : "rgba(123,79,212,0.18)",
            border: `1px solid ${eligible ? "rgba(123,79,212,0.6)" : "rgba(123,79,212,0.25)"}`,
            color: eligible ? "white" : "rgba(255,255,255,0.5)",
            fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
            cursor: eligible && mintState === "idle" ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s",
            boxShadow: eligible && mintState === "idle" ? "0 4px 20px rgba(123,79,212,0.35)" : "none",
          }}
        >
          <Sparkles size={14} />
          {hasCard ? "Mint another card" : "Mint card"}
        </button>
        <p className="text-[10px] text-[var(--color-text-disabled)] mt-2 text-center">
          Each card is a permanent snapshot. Review before you mint.
        </p>
      </div>
    </div>
  );
}

function RequirementRow({
  met,
  icon,
  label,
  detail,
}: {
  met: boolean;
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        {met ? (
          <CheckCircle2 size={15} className="text-[#30d158]" />
        ) : (
          <div className="text-[var(--color-text-disabled)]">{icon}</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[11px] font-semibold leading-snug ${met ? "text-[var(--color-text-muted)] line-through" : "text-white/80"}`}>
            {label}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums flex-shrink-0">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summoning overlay — fullscreen "card is being born" animation.
// Replaces the previous review form. User just waits (typically 20–40s) while
// generate → mint chains behind the scenes.
// ─────────────────────────────────────────────────────────────────────────────
const STEP_LABELS: Record<"conjuring" | "painting" | "binding", string> = {
  conjuring: "Consulting the archives",
  painting:  "Painting the pixels",
  binding:   "Binding to the vault",
};

const STEP_INDEX: Record<"conjuring" | "painting" | "binding", number> = {
  conjuring: 0,
  painting:  1,
  binding:   2,
};

function SummoningOverlay({ step }: { step: "conjuring" | "painting" | "binding" }) {
  const idx = STEP_INDEX[step];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Minting card: ${STEP_LABELS[step]}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "radial-gradient(ellipse at 50% 45%, rgba(35,15,70,0.96) 0%, rgba(3,3,10,0.98) 65%)",
        backdropFilter: "blur(14px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "mvSummonFade 0.35s ease-out",
      }}
    >
      <style>{`
        @keyframes mvSummonFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mvOrbPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
        @keyframes mvOrbSpin { to { transform: rotate(360deg); } }
        @keyframes mvOrbSpinReverse { to { transform: rotate(-360deg); } }
        @keyframes mvDustFloat {
          0%   { transform: translate(0, 0)   scale(1);    opacity: 0; }
          20%  { opacity: 0.8; }
          80%  { opacity: 0.5; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.4); opacity: 0; }
        }
        @keyframes mvStepFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @media (prefers-reduced-motion: reduce) {
          .mv-orb-inner, .mv-orb-ring, .mv-dust, .mv-step-text { animation: none !important; }
        }
      `}</style>

      {/* Central orb — concentric rings + pulsing core */}
      <div
        style={{
          position: "relative",
          width: 180,
          height: 180,
          marginBottom: 48,
        }}
      >
        {/* Outer ring */}
        <div
          className="mv-orb-ring"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px solid rgba(168,85,247,0.35)",
            boxShadow: "0 0 60px rgba(123,79,212,0.25), inset 0 0 40px rgba(123,79,212,0.15)",
            animation: "mvOrbSpin 14s linear infinite",
          }}
        />
        {/* Middle ring (reverse) */}
        <div
          className="mv-orb-ring"
          style={{
            position: "absolute",
            inset: 20,
            borderRadius: "50%",
            border: "1px dashed rgba(200,140,255,0.3)",
            animation: "mvOrbSpinReverse 9s linear infinite",
          }}
        />
        {/* Inner pulsing core */}
        <div
          className="mv-orb-inner"
          style={{
            position: "absolute",
            inset: 48,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 40% 40%, rgba(220,180,255,0.95) 0%, rgba(168,85,247,0.7) 35%, rgba(88,28,180,0.3) 70%, transparent 100%)",
            boxShadow:
              "0 0 40px rgba(168,85,247,0.7), 0 0 80px rgba(123,79,212,0.4)",
            animation: "mvOrbPulse 2.4s ease-in-out infinite",
          }}
        />
        <Sparkles
          size={22}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "rgba(255,255,255,0.92)",
            filter: "drop-shadow(0 0 8px rgba(255,255,255,0.6))",
          }}
        />

        {/* Floating pixel dust — 12 particles on random vectors */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const dist = 120 + (i % 3) * 18;
          const dx = Math.cos(angle) * dist;
          const dy = Math.sin(angle) * dist;
          const delay = (i * 0.18) % 2.2;
          return (
            <span
              key={i}
              className="mv-dust"
              style={
                {
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 4,
                  height: 4,
                  borderRadius: 1,
                  background: i % 2 === 0 ? "rgba(220,180,255,0.9)" : "rgba(168,85,247,0.85)",
                  boxShadow: "0 0 6px rgba(168,85,247,0.6)",
                  ["--dx" as string]: `${dx}px`,
                  ["--dy" as string]: `${dy}px`,
                  animation: `mvDustFloat 2.6s ease-out ${delay}s infinite`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      {/* Title */}
      <p
        style={{
          margin: 0,
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "rgba(200,180,255,0.55)",
        }}
      >
        Summoning your card
      </p>

      {/* Current step label — fades in on change */}
      <p
        key={step}
        className="mv-step-text"
        style={{
          margin: "14px 0 0",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.015em",
          color: "rgba(240,230,255,0.98)",
          textAlign: "center",
          animation: "mvStepFade 0.4s ease-out",
          textShadow: "0 0 20px rgba(168,85,247,0.35)",
        }}
      >
        {STEP_LABELS[step]}…
      </p>

      {/* Step dots */}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {(["conjuring", "painting", "binding"] as const).map((s, i) => {
          const active = i === idx;
          const done = i < idx;
          return (
            <span
              key={s}
              style={{
                width: active ? 28 : 8,
                height: 8,
                borderRadius: 4,
                background: done
                  ? "rgba(168,85,247,0.85)"
                  : active
                  ? "linear-gradient(90deg, rgba(168,85,247,0.9), rgba(220,180,255,0.95))"
                  : "rgba(168,85,247,0.2)",
                boxShadow: active ? "0 0 12px rgba(168,85,247,0.65)" : "none",
                transition: "width 0.35s ease, background 0.35s ease",
              }}
            />
          );
        })}
      </div>

      {/* Subtle reassurance text */}
      <p
        style={{
          margin: "26px 0 0",
          fontFamily: "ui-monospace, monospace",
          fontSize: 10,
          color: "rgba(160,140,200,0.45)",
          letterSpacing: "0.08em",
          textAlign: "center",
        }}
      >
        This takes 20–40 seconds. Don&rsquo;t leave.
      </p>
    </div>
  );
}
