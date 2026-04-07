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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 stagger-children">
      {/* Build Score card */}
      <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Award size={17} style={{ color: levelColor }} />
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Build Score</p>
          </div>
          <Link href="/profile" className="text-[10px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
            DETAILS →
          </Link>
        </div>
        <div className="flex items-end gap-3 mb-4">
          <span className="text-5xl font-black display-num">
            <AnimatedCounter value={buildScore} duration={1800} />
          </span>
          <span
            className="text-[10px] font-bold px-3 py-1 rounded-full mb-2 uppercase tracking-wider"
            style={{ background: `${levelColor}15`, color: levelColor, border: `1px solid ${levelColor}25` }}
          >
            {buildLevel}
          </span>
        </div>
        {nextLevel && nextThreshold !== null ? (
          <>
            <div className="score-bar mb-2">
              <div
                className="score-bar-fill"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${levelColor}, ${levelColor}99)`,
                }}
              />
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] tabular">
              <AnimatedCounter value={nextThreshold - buildScore} duration={1800} /> pts to {nextLevel}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-[var(--color-text-muted)]">Maximum level reached.</p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatTile label="Vehicles" value={carCount} />
        <StatTile label="Mods" value={totalMods} />
        <StatTile
          label="Invested"
          value={totalInvested}
          format={(n) => totalInvested > 0 ? formatCurrency(Math.round(n)) : "—"}
          accent
        />
      </div>
    </div>
  );
}

function StatTile({
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
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 text-center flex flex-col justify-center">
      <p className={`text-2xl font-black display-num ${accent ? "text-[#60A5FA]" : ""}`}>
        <AnimatedCounter value={value} duration={1500} format={format} />
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}
