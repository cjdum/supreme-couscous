"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Sparkles, Camera, Loader2, CheckCircle2, ArrowRight, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import type { CardEligibility, MintedCard } from "@/lib/pixel-card";
import { CARD_BORDER_COLOR } from "@/lib/pixel-card";
import { TradingCard } from "./trading-card";
import { CardRevealCeremony } from "./card-reveal-ceremony";

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
}

type MintState = "idle" | "occasion" | "minting" | "ceremony";

const OCCASION_EXAMPLES = [
  "Just picked her up",
  "Aerokit installed",
  "First track day",
  "New wheels dropped",
  "Engine rebuilt",
  "Hit 100k miles",
];

export function PixelCard(props: PixelCardProps) {
  const router = useRouter();
  const [mintState, setMintState] = useState<MintState>("idle");
  const [occasionInput, setOccasionInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [freshCard, setFreshCard] = useState<MintedCard | null>(null);
  const [eligibility, setEligibility] = useState<CardEligibility | null>(null);
  const [eligLoading, setEligLoading] = useState(true);

  // Trim + color validation
  const hasTrim  = !!props.trim?.trim();
  const hasColor = !!props.color?.trim();
  const needsProfile = !hasTrim || !hasColor;

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

  // ── Ceremony overlay (freshly minted) ───────────────────────────────────
  if (mintState === "ceremony" && freshCard) {
    const snap = freshCard.car_snapshot;
    return (
      <CardRevealCeremony
        card={{
          cardUrl:     freshCard.pixel_card_url,
          nickname:    freshCard.nickname,
          generatedAt: freshCard.minted_at,
          hp:          freshCard.hp,
          modCount:    freshCard.mod_count,
          buildScore:  snap.build_score,
          vinVerified: snap.vin_verified,
          cardNumber:  freshCard.card_number,
          era:         freshCard.era,
          flavorText:  freshCard.flavor_text,
          occasion:    freshCard.occasion,
          mods:        snap.mods ?? [],
          edition:     props.cardCount + 1,
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

    setMintState("minting");
    setError(null);

    try {
      const res = await fetch(`/api/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: props.carId, occasion }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed to mint");
      }
      setFreshCard(json.card as MintedCard);
      haptic("success");
      setMintState("ceremony");
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
                What&rsquo;s the occasion?
              </h3>
              <button
                onClick={() => setMintState("idle")}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(200,180,240,0.4)", padding: 4, display: "flex" }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(160,140,200,0.55)", letterSpacing: "0.06em", marginBottom: 18, lineHeight: 1.5 }}>
              This note is frozen onto the card forever — a permanent timestamp of this moment.
            </p>

            {/* Input */}
            <textarea
              value={occasionInput}
              onChange={(e) => {
                setOccasionInput(e.target.value.slice(0, 100));
                setError(null);
              }}
              placeholder='e.g. "Just picked her up" or "Aerokit installed"'
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

      {/* ── Requirements list ──────────────────────────────────────────────── */}
      <div className="mt-4 space-y-2">
        <RequirementRow
          met={hasPhoto}
          icon={<Camera size={13} />}
          label="Upload a real photo"
          detail={hasPhoto ? "Done" : "Required"}
        />
        <RequirementRow
          met={hasTrim}
          icon={<Lock size={13} />}
          label="Set car trim"
          detail={hasTrim ? "Done" : "Required"}
        />
        <RequirementRow
          met={hasColor}
          icon={<Lock size={13} />}
          label="Set exterior color"
          detail={hasColor ? "Done" : "Required"}
        />
      </div>

      {/* ── Profile requirement warning ────────────────────────────────────── */}
      {needsProfile && (
        <div
          role="alert"
          className="mt-3 rounded-xl border px-3.5 py-2.5 text-[11px]"
          style={{
            background: "rgba(245,166,35,0.08)",
            borderColor: "rgba(245,166,35,0.3)",
            color: "rgba(245,166,35,0.9)",
            fontFamily: "ui-monospace, monospace",
            lineHeight: 1.6,
          }}
        >
          Fill in your car&rsquo;s trim and color before minting a card. Edit the car details above to add them.
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
          disabled={!eligible || mintState === "minting" || needsProfile}
          style={{
            width: "100%", height: 44, borderRadius: 12,
            background: !eligible || mintState === "minting" || needsProfile
              ? "rgba(123,79,212,0.18)"
              : "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
            border: `1px solid ${eligible && !needsProfile ? "rgba(123,79,212,0.6)" : "rgba(123,79,212,0.25)"}`,
            color: eligible && !needsProfile ? "white" : "rgba(255,255,255,0.5)",
            fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
            cursor: !eligible || mintState === "minting" || needsProfile ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s",
            boxShadow: eligible && mintState === "idle" && !needsProfile ? "0 4px 20px rgba(123,79,212,0.35)" : "none",
          }}
        >
          {mintState === "minting" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Minting... (up to 40s)
            </>
          ) : (
            <>
              <Sparkles size={14} />
              {hasCard ? "Mint another card" : "Mint card"}
            </>
          )}
        </button>
        <p className="text-[10px] text-[var(--color-text-disabled)] mt-2 text-center">
          Each card is a permanent snapshot. Mint as many as you like.
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
