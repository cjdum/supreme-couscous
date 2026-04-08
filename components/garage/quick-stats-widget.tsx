"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TrendingUp, Sparkles, Clock, ListTodo, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { LEVEL_COLORS, LEVELS } from "@/lib/build-score";

interface QuickStatsWidgetProps {
  totalInvested: number;
  mostRecentMod: { name: string; carLabel: string; createdAt: string } | null;
  nextPlannedMod: { name: string; carLabel: string } | null;
  buildScore: number;
  buildLevel: string;
  nextThreshold: number | null;
  progress: number;
  primaryCarId: string;
  primaryCarLabel: string;
  primaryCarModList: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function QuickStatsWidget({
  totalInvested,
  mostRecentMod,
  nextPlannedMod,
  buildScore,
  buildLevel,
  nextThreshold,
  progress,
  primaryCarId,
  primaryCarLabel,
  primaryCarModList,
}: QuickStatsWidgetProps) {
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const fetchedRef = useRef(false);

  const levelColor = LEVEL_COLORS[buildLevel] ?? "#9ca3af";
  const nextLevel = LEVELS.find((l) => l.threshold > buildScore);

  // Fetch AI build tip once per session
  useEffect(() => {
    if (fetchedRef.current) return;
    const sessionKey = `modvault_build_tip_${primaryCarId}`;
    const cached = sessionStorage.getItem(sessionKey);
    if (cached) {
      setTip(cached);
      fetchedRef.current = true;
      return;
    }
    fetchedRef.current = true;
    setTipLoading(true);
    fetch("/api/ai/build-tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carLabel: primaryCarLabel, mods: primaryCarModList }),
    })
      .then((r) => r.json())
      .then((json: { tip?: string }) => {
        if (json.tip) {
          setTip(json.tip);
          sessionStorage.setItem(sessionKey, json.tip);
        }
      })
      .catch(() => {})
      .finally(() => setTipLoading(false));
  }, [primaryCarId, primaryCarLabel, primaryCarModList]);

  return (
    <div
      className="rounded-3xl p-5 space-y-4"
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp size={14} style={{ color: "var(--color-accent-bright)" }} />
        <p
          style={{
            fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          Quick Stats
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Invested */}
        <div
          className="rounded-2xl p-3"
          style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.18)" }}
        >
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(147,197,253,0.6)", margin: "0 0 4px" }}>
            Total Invested
          </p>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontWeight: 900, color: "#93c5fd", letterSpacing: "-0.02em", margin: 0 }}>
            {formatCurrency(totalInvested)}
          </p>
        </div>

        {/* Build Score */}
        <div
          className="rounded-2xl p-3"
          style={{ background: "rgba(123,79,212,0.07)", border: "1px solid rgba(123,79,212,0.2)" }}
        >
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(200,180,240,0.55)", margin: "0 0 2px" }}>
            Build Score
          </p>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontWeight: 900, color: levelColor, letterSpacing: "-0.02em" }}>
              {buildScore}
            </span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, color: levelColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {buildLevel}
            </span>
          </div>
          {/* Progress bar */}
          {nextLevel && (
            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%", borderRadius: 2,
                  background: levelColor,
                  width: `${Math.min(100, progress)}%`,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          )}
          {nextLevel && (
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 7, color: "rgba(200,180,240,0.35)", letterSpacing: "0.06em", marginTop: 2, margin: "3px 0 0" }}>
              → {nextLevel.name} at {nextThreshold}
            </p>
          )}
        </div>
      </div>

      {/* Recent mod */}
      {mostRecentMod && (
        <div className="flex items-start gap-2.5">
          <Clock size={12} style={{ color: "var(--color-text-muted)", flexShrink: 0, marginTop: 1 }} />
          <div className="min-w-0">
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(200,180,240,0.45)", margin: "0 0 2px" }}>
              Last Mod
            </p>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700, color: "var(--color-text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {mostRecentMod.name}
            </p>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: "rgba(160,140,200,0.45)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {mostRecentMod.carLabel} · {formatRelativeTime(mostRecentMod.createdAt)}
            </p>
          </div>
        </div>
      )}

      {/* Next planned */}
      {nextPlannedMod && (
        <div className="flex items-start gap-2.5">
          <ListTodo size={12} style={{ color: "var(--color-text-muted)", flexShrink: 0, marginTop: 1 }} />
          <div className="min-w-0">
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(200,180,240,0.45)", margin: "0 0 2px" }}>
              Up Next
            </p>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700, color: "var(--color-text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nextPlannedMod.name}
            </p>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: "rgba(160,140,200,0.45)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nextPlannedMod.carLabel}
            </p>
          </div>
        </div>
      )}

      {/* AI Build Tip */}
      <div
        className="rounded-2xl p-3 flex items-start gap-2.5"
        style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)" }}
      >
        <Sparkles size={12} style={{ color: "#c084fc", flexShrink: 0, marginTop: 1 }} />
        <div className="min-w-0 flex-1">
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(192,132,252,0.55)", margin: "0 0 4px" }}>
            AI Build Tip
          </p>
          {tipLoading ? (
            <div className="flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin" style={{ color: "#c084fc" }} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(192,132,252,0.45)" }}>Thinking...</span>
            </div>
          ) : tip ? (
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(233,213,255,0.8)", lineHeight: 1.6, margin: 0 }}>
              {tip}
            </p>
          ) : (
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(192,132,252,0.35)", margin: 0 }}>
              Add more mods to unlock tips.
            </p>
          )}
        </div>
      </div>

      <Link
        href={`/garage/${primaryCarId}`}
        className="block text-center text-[10px] font-bold transition-colors"
        style={{
          fontFamily: "ui-monospace, monospace", letterSpacing: "0.1em", textTransform: "uppercase",
          color: "rgba(200,180,240,0.4)",
        }}
      >
        View full garage →
      </Link>
    </div>
  );
}
