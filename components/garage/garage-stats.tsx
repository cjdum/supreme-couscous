"use client";

import Link from "next/link";
import { Award } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { formatCurrency } from "@/lib/utils";

interface GarageStatsProps {
  buildScore: number;
  buildLevel: string;
  levelColor: string;
  nextLevel: string | null;
  nextThreshold: number | null;
  progress: number;
  carCount: number;
  totalMods: number;
  totalInvested: number;
}

export function GarageStats({
  buildScore,
  buildLevel,
  levelColor,
  nextLevel,
  nextThreshold,
  progress,
  carCount,
  totalMods,
  totalInvested,
}: GarageStatsProps) {
  return (
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
      {/* ── Single condensed strip: score | divider | 3 stat cells ── */}
      <div className="flex flex-col sm:flex-row sm:items-stretch divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)]">
        {/* Build score (lead) */}
        <div className="flex-1 sm:max-w-[44%] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award size={14} style={{ color: levelColor }} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Build Score</p>
            </div>
            <Link href="/profile" className="text-[10px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
              DETAILS →
            </Link>
          </div>
          <div className="flex items-end gap-2.5 mb-3">
            <span className="text-4xl font-black display-num leading-none">
              <AnimatedCounter value={buildScore} duration={1800} />
            </span>
            <span
              className="text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-0.5"
              style={{ background: `${levelColor}15`, color: levelColor, border: `1px solid ${levelColor}25` }}
            >
              {buildLevel}
            </span>
          </div>
          {nextLevel && nextThreshold !== null ? (
            <>
              <div className="score-bar mb-1.5">
                <div
                  className="score-bar-fill"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${levelColor}, ${levelColor}99)`,
                  }}
                />
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] tabular">
                <AnimatedCounter value={nextThreshold - buildScore} duration={1800} /> pts to {nextLevel}
              </p>
            </>
          ) : (
            <p className="text-[10px] text-[var(--color-text-muted)]">Maximum level reached.</p>
          )}
        </div>

        {/* Stat cells inline */}
        <div className="flex-1 grid grid-cols-3 divide-x divide-[var(--color-border)]">
          <StatCell label="Vehicles" value={carCount} />
          <StatCell label="Mods" value={totalMods} />
          <StatCell
            label="Invested"
            value={totalInvested}
            format={(n) => totalInvested > 0 ? formatCurrency(Math.round(n)) : "—"}
            accent
          />
        </div>
      </div>

    </div>
  );
}

function StatCell({
  label,
  value,
  format,
  accent,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-5 text-center">
      <p className={`text-2xl font-black display-num leading-none ${accent ? "text-[#60A5FA]" : ""}`}>
        <AnimatedCounter value={value} duration={1500} format={format} />
      </p>
      <p className="text-[9px] text-[var(--color-text-muted)] mt-2 font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}
