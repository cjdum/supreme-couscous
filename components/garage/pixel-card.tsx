"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Sparkles, CheckCircle2, Circle, Loader2, ShieldCheck } from "lucide-react";
import { haptic } from "@/lib/haptics";
import {
  calculateRarityFromScore,
  type EligibilityCheck,
  type EligibilityResponse,
  type PixelCardRarity,
} from "@/lib/pixel-card";
import { TradingCard, type TradingCardData } from "./trading-card";
import { CardRevealCeremony } from "./card-reveal-ceremony";

interface PixelCardProps {
  carId: string;
  carLabel: string;
  // Existing card data (null = not yet minted)
  pixelCardUrl: string | null;
  pixelCardNickname: string | null;
  pixelCardGeneratedAt: string | null;
  pixelCardHp: number | null;
  pixelCardModCount: number | null;
  pixelCardBuildScore: number | null;
  pixelCardRarity: string | null;
  vinVerified: boolean;
  username?: string; // for share URL
}

type MintState = "idle" | "generating" | "ceremony";

export function PixelCard(props: PixelCardProps) {
  const router = useRouter();
  const [mintState, setMintState]   = useState<MintState>("idle");
  const [error, setError]           = useState<string | null>(null);
  const [freshCard, setFreshCard]   = useState<TradingCardData | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [eligLoading, setEligLoading] = useState(true);

  // ── Fetch server-side eligibility on mount ─────────────────────────────────
  useEffect(() => {
    if (props.pixelCardUrl) return; // already minted
    setEligLoading(true);
    fetch(`/api/cars/${props.carId}/check-eligibility`)
      .then((r) => r.json())
      .then((data: EligibilityResponse) => setEligibility(data))
      .catch(() =>
        setEligibility({ eligible: false, checks: [] })
      )
      .finally(() => setEligLoading(false));
  }, [props.carId, props.pixelCardUrl]);

  // ── Already generated — show permanent card ─────────────────────────────────
  if (props.pixelCardUrl && props.pixelCardNickname) {
    const rarity: PixelCardRarity =
      (props.pixelCardRarity as PixelCardRarity) ??
      calculateRarityFromScore(props.pixelCardBuildScore ?? 0);

    const cardData: TradingCardData = {
      cardUrl:     props.pixelCardUrl,
      nickname:    props.pixelCardNickname,
      generatedAt: props.pixelCardGeneratedAt,
      hp:          props.pixelCardHp,
      modCount:    props.pixelCardModCount,
      buildScore:  props.pixelCardBuildScore,
      rarity,
      vinVerified: props.vinVerified,
    };
    return (
      <div className="flex flex-col items-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[rgba(245,215,110,0.6)] mb-4">
          Pixel card · permanent
        </p>
        <TradingCard
          {...cardData}
          carLabel={props.carLabel}
          idle
          interactive
          showShare
          onShare={() => {
            const url = `${window.location.origin}/u/`;
            navigator.clipboard.writeText(url).catch(() => {});
            haptic("light");
          }}
        />
      </div>
    );
  }

  // ── Ceremony overlay (freshly minted) ───────────────────────────────────
  if (mintState === "ceremony" && freshCard) {
    return (
      <CardRevealCeremony
        card={freshCard}
        carLabel={props.carLabel}
        onComplete={() => {
          router.refresh();
        }}
      />
    );
  }

  async function handleGenerate() {
    if (mintState !== "idle") return;
    const confirmed = window.confirm(
      "Mint your pixel card? This is permanent — the image and nickname are locked forever."
    );
    if (!confirmed) return;

    setMintState("generating");
    setError(null);
    try {
      const res  = await fetch(`/api/cars/${props.carId}/pixel-card`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed to generate");
      }
      const rarity: PixelCardRarity =
        (json.pixel_card_rarity as PixelCardRarity) ?? "STOCK";
      const card: TradingCardData = {
        cardUrl:     json.pixel_card_url,
        nickname:    json.pixel_card_nickname,
        generatedAt: json.pixel_card_generated_at,
        hp:          json.pixel_card_hp,
        modCount:    json.pixel_card_mod_count,
        buildScore:  json.pixel_card_build_score,
        rarity,
        vinVerified: json.vin_verified ?? props.vinVerified,
      };
      setFreshCard(card);
      haptic("success");
      setMintState("ceremony");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
      haptic("heavy");
      setMintState("idle");
    }
  }

  // ── Eligibility loading skeleton ────────────────────────────────────────────
  if (eligLoading) {
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
        <div className="mt-4 space-y-2">
          {[1,2,3].map((i) => (
            <div key={i} className="h-5 rounded bg-[var(--color-bg-elevated)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const eligible = eligibility?.eligible ?? false;
  const checks   = eligibility?.checks ?? [];

  // ── Locked / eligible state ──────────────────────────────────────────────────
  return (
    <div>
      {/* ── Section label ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
          {eligible ? (
            <Unlock size={12} className="text-[#7b4fd4]" />
          ) : (
            <Lock size={12} className="text-[var(--color-text-muted)]" />
          )}
        </div>
        <div>
          <p className="text-xs font-bold">
            {eligible ? "Ready to mint" : "Pixel card locked"}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {eligible
              ? "Your collectible is waiting"
              : "Complete all requirements to unlock"}
          </p>
        </div>
      </div>

      {/* ── VIN hint (if not verified) ──────────────────────────────────── */}
      {!props.vinVerified && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
          <ShieldCheck size={13} className="text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
            <span className="text-white/60 font-semibold">Tip:</span> Verify your VIN in car settings for a higher rarity card (BUILDER or LEGEND).
          </p>
        </div>
      )}

      {/* ── Card silhouette with progress ───────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden relative mx-auto"
        style={{
          width: 260,
          height: 180,
          background: eligible
            ? "linear-gradient(135deg, #1a0a2e 0%, #0d0d1a 100%)"
            : "linear-gradient(135deg, #0d0d18 0%, #0a0a12 100%)",
          border: `2px solid ${eligible ? "rgba(123,79,212,0.6)" : "rgba(61,61,92,0.8)"}`,
          boxShadow: eligible ? "0 0 24px rgba(123,79,212,0.25)" : "none",
          transition: "all 0.5s ease",
        }}
      >
        {/* Pixel grid overlay */}
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

        {/* Lock icon or unlocked sparkle */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {eligible ? (
            <>
              <div
                className="rounded-full flex items-center justify-center"
                style={{ width: 44, height: 44, background: "rgba(123,79,212,0.2)", border: "2px solid rgba(123,79,212,0.5)" }}
              >
                <Sparkles size={20} style={{ color: "#7b4fd4" }} />
              </div>
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#7b4fd4", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Unlocked
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
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.25)" }}>
                {checks.filter((c) => c.met).length}/{checks.length} done
              </p>
            </>
          )}
        </div>

        {/* Progress bar strip at bottom */}
        {checks.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round((checks.filter((c) => c.met).length / checks.length) * 100)}%`,
                background: eligible
                  ? "linear-gradient(90deg, #7b4fd4, #a855f7)"
                  : "linear-gradient(90deg, #3b82f6, #7b4fd4)",
                transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                borderRadius: "0 2px 0 0",
              }}
            />
          </div>
        )}
      </div>

      {/* ── Requirements list ────────────────────────────────────────────── */}
      <div className="mt-4 space-y-2">
        {checks.map((check) => (
          <RequirementRow key={check.id} check={check} />
        ))}
      </div>

      {/* ── Error message ────────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-3.5 py-2.5 text-[11px] text-[var(--color-danger)]"
        >
          {error}
        </div>
      )}

      {/* ── Mint button (eligible only) ──────────────────────────────────── */}
      {eligible && (
        <div className="mt-4">
          <button
            onClick={handleGenerate}
            disabled={mintState !== "idle"}
            style={{
              width: "100%",
              height: 44,
              borderRadius: 12,
              background: mintState !== "idle"
                ? "rgba(123,79,212,0.3)"
                : "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
              border: "1px solid rgba(123,79,212,0.5)",
              color: "white",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              cursor: mintState !== "idle" ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
              boxShadow: mintState === "idle" ? "0 4px 20px rgba(123,79,212,0.35)" : "none",
            }}
          >
            {mintState === "generating" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Minting... (up to 30s)
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Mint card
              </>
            )}
          </button>
          <p className="text-[10px] text-[var(--color-text-disabled)] mt-2 text-center">
            One generation per car, forever. No regeneration.
          </p>
        </div>
      )}
    </div>
  );
}

function RequirementRow({ check }: { check: EligibilityCheck }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        {check.met ? (
          <CheckCircle2 size={15} className="text-[#30d158]" />
        ) : (
          <Circle size={15} className="text-[var(--color-text-disabled)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-[11px] font-semibold leading-snug ${
              check.met ? "text-[var(--color-text-muted)] line-through" : "text-white/80"
            }`}
          >
            {check.label}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums flex-shrink-0">
            {check.detail}
          </p>
        </div>
      </div>
    </div>
  );
}
