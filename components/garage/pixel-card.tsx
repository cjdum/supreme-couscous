"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Sparkles, Camera, Clock, Loader2, CheckCircle2 } from "lucide-react";
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
}

type MintState = "idle" | "minting" | "ceremony";

export function PixelCard(props: PixelCardProps) {
  const router = useRouter();
  const [mintState, setMintState] = useState<MintState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [freshCard, setFreshCard] = useState<MintedCard | null>(null);
  const [eligibility, setEligibility] = useState<CardEligibility | null>(null);
  const [eligLoading, setEligLoading] = useState(true);

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

  async function handleGenerate() {
    if (mintState !== "idle") return;
    if (!eligibility?.eligible) return;

    setMintState("minting");
    setError(null);
    try {
      const res = await fetch(`/api/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: props.carId }),
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
  const cooldownH = eligibility?.cooldownRemainingHours ?? 0;
  const hasCard   = !!props.latestCard;

  return (
    <div>
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
            width: 260,
            height: 180,
            background: eligible
              ? "linear-gradient(135deg, #1a0a2e 0%, #0d0d1a 100%)"
              : "linear-gradient(135deg, #0d0d18 0%, #0a0a12 100%)",
            border: `2px solid ${eligible ? CARD_BORDER_COLOR : "rgba(61,61,92,0.8)"}`,
            boxShadow: eligible ? "0 0 24px rgba(123,79,212,0.30)" : "none",
            transition: "all 0.5s ease",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: [
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)",
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)",
              ].join(", "),
              pointerEvents: "none",
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            {eligible ? (
              <>
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{ width: 44, height: 44, background: "rgba(123,79,212,0.2)", border: "2px solid rgba(123,79,212,0.5)" }}
                >
                  <Sparkles size={20} style={{ color: CARD_BORDER_COLOR }} />
                </div>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: CARD_BORDER_COLOR, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  Ready
                </p>
              </>
            ) : (
              <>
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{ width: 44, height: 44, background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.1)" }}
                >
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
          met={cooldownH === 0}
          icon={<Clock size={13} />}
          label="72-hour cooldown"
          detail={cooldownH === 0 ? "Ready" : `${cooldownH}h remaining`}
        />
      </div>

      {/* ── Error message ──────────────────────────────────────────────────── */}
      {error && (
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
          onClick={handleGenerate}
          disabled={!eligible || mintState !== "idle"}
          style={{
            width: "100%",
            height: 44,
            borderRadius: 12,
            background: !eligible || mintState !== "idle"
              ? "rgba(123,79,212,0.18)"
              : "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
            border: `1px solid ${eligible ? "rgba(123,79,212,0.6)" : "rgba(123,79,212,0.25)"}`,
            color: eligible ? "white" : "rgba(255,255,255,0.5)",
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            cursor: !eligible || mintState !== "idle" ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
            boxShadow: eligible && mintState === "idle" ? "0 4px 20px rgba(123,79,212,0.35)" : "none",
          }}
        >
          {mintState === "minting" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Minting... (up to 30s)
            </>
          ) : (
            <>
              <Sparkles size={14} />
              {hasCard ? "Mint another card" : "Mint card"}
            </>
          )}
        </button>
        <p className="text-[10px] text-[var(--color-text-disabled)] mt-2 text-center">
          Each card is a permanent snapshot. Mint as many as you like — every 72h.
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
          <p
            className={`text-[11px] font-semibold leading-snug ${
              met ? "text-[var(--color-text-muted)] line-through" : "text-white/80"
            }`}
          >
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
