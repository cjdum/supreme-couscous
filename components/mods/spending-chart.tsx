"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface ChartItem {
  name: string;
  value: number;
  color: string;
}

interface SpendingChartProps {
  data: ChartItem[];
  total: number;
}

const SIZE = 220;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUM = 2 * Math.PI * RADIUS;
const GAP = 0.012; // arc gap (fraction)

export function SpendingChart({ data, total }: SpendingChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (data.length === 0 || total === 0) return null;

  const sorted = [...data].sort((a, b) => b.value - a.value);

  // Build arc segments
  let cumulative = 0;
  const segments = sorted.map((item) => {
    const fraction = item.value / total;
    const startFraction = cumulative;
    cumulative += fraction;
    const arcLen = CIRCUM * (fraction - GAP);
    const offset = -CIRCUM * startFraction;
    return {
      ...item,
      arcLen,
      offset,
      pct: Math.round(fraction * 100),
    };
  });

  const displayValue = hovered !== null ? sorted[hovered].value : total;
  const displayLabel = hovered !== null ? sorted[hovered].name : "Total Invested";

  return (
    <div className="space-y-5">
      {/* Animated arc chart */}
      <div className="relative flex items-center justify-center" style={{ height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-bg-elevated)"
            strokeWidth={STROKE}
          />
          {/* Animated segments */}
          {segments.map((seg, i) => {
            const isActive = hovered === i;
            return (
              <circle
                key={i}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={seg.color}
                strokeWidth={isActive ? STROKE + 4 : STROKE}
                strokeLinecap="round"
                strokeDasharray={`${mounted ? seg.arcLen : 0} ${CIRCUM}`}
                strokeDashoffset={seg.offset}
                style={{
                  transition: `stroke-dasharray 1200ms cubic-bezier(0.16, 1, 0.3, 1), stroke-width 200ms ease, opacity 200ms ease`,
                  transitionDelay: `${i * 100}ms`,
                  opacity: hovered !== null && hovered !== i ? 0.35 : 1,
                  cursor: "pointer",
                  filter: isActive ? `drop-shadow(0 0 12px ${seg.color}80)` : undefined,
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-wider mb-1">{displayLabel}</p>
          <p className="text-3xl font-black display-num text-white">
            <AnimatedCounter value={displayValue} duration={500} format={(n) => formatCurrency(Math.round(n))} />
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2.5" role="list" aria-label="Category breakdown">
        {segments.map((item, i) => (
          <button
            key={item.name}
            type="button"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`w-full flex items-center justify-between py-1 px-1 rounded-lg transition-colors ${
              hovered === i ? "bg-[var(--color-bg-elevated)]" : ""
            }`}
            role="listitem"
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{item.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold tabular text-white">{formatCurrency(item.value)}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] w-9 text-right tabular font-medium">
                {item.pct}%
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
