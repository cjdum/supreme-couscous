"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Sparkles, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { haptic } from "@/lib/haptics";
import {
  checkPixelCardEligibility,
  type RequirementCheck,
} from "@/lib/pixel-card";

interface PixelCardProps {
  carId: string;
  photoCount: number;
  description: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  buildScore: number;
  pixelCardUrl: string | null;
  pixelCardNickname: string | null;
  pixelCardGeneratedAt: string | null;
}

export function PixelCard(props: PixelCardProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generated state — render the permanent card.
  if (props.pixelCardUrl && props.pixelCardNickname) {
    return (
      <GeneratedCard
        url={props.pixelCardUrl}
        nickname={props.pixelCardNickname}
        generatedAt={props.pixelCardGeneratedAt}
      />
    );
  }

  const eligibility = checkPixelCardEligibility({
    photoCount: props.photoCount,
    description: props.description,
    make: props.make,
    model: props.model,
    year: props.year,
    buildScore: props.buildScore,
  });

  async function handleGenerate() {
    if (generating) return;
    const confirmed = window.confirm(
      "Generate your pixel card? This is permanent — once created, it can never be regenerated or changed."
    );
    if (!confirmed) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${props.carId}/pixel-card`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed to generate");
      }
      haptic("success");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
      haptic("heavy");
      setGenerating(false);
    }
  }

  // Eligible but not yet generated.
  if (eligibility.eligible) {
    return (
      <div className="rounded-2xl border border-[rgba(251,191,36,0.35)] bg-[var(--color-bg-card)] overflow-hidden shadow-[0_4px_24px_rgba(251,191,36,0.10)]">
        <div className="p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={14} className="text-[#fbbf24]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#fbbf24]">
              Pixel card unlocked
            </p>
          </div>
          <h3 className="text-base font-bold leading-snug mb-1">Ready to mint</h3>
          <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mb-4">
            Claude writes a nickname, DALL·E draws a 16-bit sprite. It&apos;s permanent —
            you get one shot, ever.
          </p>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-3.5 py-2.5 text-[11px] text-[var(--color-danger)] mb-3"
            >
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full h-11 rounded-xl bg-[#fbbf24] text-black text-xs font-bold hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition"
          >
            {generating ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Generating... (up to 30s)
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Generate pixel card
              </>
            )}
          </button>
          <p className="text-[10px] text-[var(--color-text-disabled)] mt-2 text-center">
            Once generated, this cannot be undone or regenerated.
          </p>
        </div>
      </div>
    );
  }

  // Locked — show checklist.
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
      <div className="p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-1.5">
          <Lock size={13} className="text-[var(--color-text-muted)]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Pixel card — locked
          </p>
        </div>
        <h3 className="text-base font-bold leading-snug mb-1">Earn your collectible</h3>
        <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mb-4">
          Build this car up to unlock a one-of-a-kind pixel art trading card.
        </p>

        <ul className="space-y-2">
          {eligibility.requirements.map((req) => (
            <RequirementRow key={req.id} req={req} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function RequirementRow({ req }: { req: RequirementCheck }) {
  return (
    <li className="flex items-start gap-2.5">
      {req.met ? (
        <CheckCircle2 size={14} className="text-[#30d158] mt-0.5 flex-shrink-0" />
      ) : (
        <Circle size={14} className="text-[var(--color-text-disabled)] mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-semibold leading-snug ${
            req.met ? "text-[var(--color-text-secondary)] line-through" : "text-white"
          }`}
        >
          {req.label}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 tabular">
          {req.detail}
        </p>
      </div>
    </li>
  );
}

function GeneratedCard({
  url,
  nickname,
  generatedAt,
}: {
  url: string;
  nickname: string;
  generatedAt: string | null;
}) {
  const dateLabel = generatedAt
    ? new Date(generatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: "#0a0c10",
        border: "1px solid rgba(251,191,36,0.25)",
        boxShadow:
          "0 0 0 1px rgba(251,191,36,0.08) inset, 0 8px 48px rgba(251,191,36,0.12)",
      }}
    >
      {/* Shimmer frame */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.12) 0%, transparent 60%)",
        }}
      />

      <div className="relative p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={12} className="text-[#fbbf24]" />
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#fbbf24]">
            Pixel card · permanent
          </p>
        </div>

        <div
          className="rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)]"
          style={{ background: "#0a0c10", aspectRatio: "1/1" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={nickname}
            className="w-full h-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <div className="mt-4 text-center">
          <p
            className="text-lg font-black tracking-[0.15em] uppercase text-white"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            {nickname}
          </p>
          {dateLabel && (
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 tabular">
              Minted {dateLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
