"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatCurrency, getCategoryColor, getCategoryLabel } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import type { ModCategory } from "@/lib/supabase/types";

interface MonthlyDataPoint {
  month: string;
  invested: number;
  cumulative: number;
  count: number;
}

interface StatsChartsProps {
  monthlyData: MonthlyDataPoint[];
  categoryTotals: { category: ModCategory; total: number; count: number }[];
  totalInvested: number;
  modCount: number;
  bestMonth: { month: string; total: number } | null;
  averagePerMonth: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 shadow-2xl">
      <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-bold text-white tabular">
          {p.dataKey === "cumulative" ? "Total: " : "Spent: "}{formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export function StatsCharts({
  monthlyData,
  categoryTotals,
  totalInvested,
  modCount,
  bestMonth,
  averagePerMonth,
}: StatsChartsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const maxCategoryTotal = Math.max(...categoryTotals.map((c) => c.total), 1);
  const sortedCategories = [...categoryTotals].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Total Invested"
          value={totalInvested}
          format={(n) => formatCurrency(Math.round(n))}
          accent="#60A5FA"
        />
        <KPICard label="Mods Logged" value={modCount} accent="#30d158" />
        <KPICard
          label="Avg / Month"
          value={averagePerMonth}
          format={(n) => formatCurrency(Math.round(n))}
          accent="#fbbf24"
        />
        <KPICard
          label="Best Month"
          value={bestMonth?.total ?? 0}
          format={(n) => (bestMonth ? formatCurrency(Math.round(n)) : "—")}
          accent="#bf5af2"
          subtitle={bestMonth?.month}
        />
      </div>

      {/* Cumulative line chart */}
      {monthlyData.length > 0 && (
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold tracking-tight">Total Invested Over Time</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Cumulative spend</p>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1a1a1a" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#555", fontSize: 11 }}
                  axisLine={{ stroke: "#2a2a2a" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#555", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="url(#cumulativeFill)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly spend chart */}
      {monthlyData.length > 0 && (
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold tracking-tight">Spend Per Month</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Monthly investment</p>
            </div>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#555", fontSize: 11 }} axisLine={{ stroke: "#2a2a2a" }} tickLine={false} />
                <YAxis
                  tick={{ fill: "#555", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="invested"
                  stroke="#60A5FA"
                  strokeWidth={2.5}
                  dot={{ fill: "#60A5FA", r: 4 }}
                  activeDot={{ r: 6, fill: "#60A5FA" }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category bars (animated) */}
      {sortedCategories.length > 0 && (
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
          <h2 className="text-base font-bold tracking-tight mb-5">Spend by Category</h2>
          <div className="space-y-4">
            {sortedCategories.map((cat, i) => {
              const pct = (cat.total / maxCategoryTotal) * 100;
              const color = getCategoryColor(cat.category);
              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                      <span className="text-sm font-bold text-white">{getCategoryLabel(cat.category)}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                        {cat.count} {cat.count === 1 ? "mod" : "mods"}
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular text-white">{formatCurrency(cat.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: mounted ? `${pct}%` : "0%",
                        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                        boxShadow: `0 0 12px ${color}44`,
                        transition: `width 1200ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 100}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({
  label,
  value,
  format,
  accent,
  subtitle,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  accent?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5">
      <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-black display-num" style={{ color: accent }}>
        <AnimatedCounter value={value} duration={1800} format={format} />
      </p>
      {subtitle && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
    </div>
  );
}
