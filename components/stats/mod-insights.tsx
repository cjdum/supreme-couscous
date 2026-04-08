"use client";

import { useMemo } from "react";
import { DollarSign, TrendingUp, Wrench, Crown, Gauge, PieChart as PieIcon } from "lucide-react";
import type { ModCategory } from "@/lib/supabase/types";
import { getCategoryLabel, getCategoryColor, formatCurrency } from "@/lib/utils";

interface ModInsightsProps {
  mods: Array<{
    id: string;
    car_id: string;
    name: string;
    category: ModCategory;
    cost: number | null;
    install_date: string | null;
    status: "installed" | "wishlist";
  }>;
  cars: Array<{ id: string; horsepower: number | null; stock_horsepower: number | null }>;
}

export function ModInsights({ mods, cars }: ModInsightsProps) {
  const insights = useMemo(() => {
    const installed = mods.filter((m) => m.status === "installed");
    const wishlist  = mods.filter((m) => m.status === "wishlist");

    const totalSpent = installed.reduce((s, m) => s + (m.cost ?? 0), 0);
    const wishlistCost = wishlist.reduce((s, m) => s + (m.cost ?? 0), 0);

    // Biggest single mod
    const biggest = [...installed]
      .filter((m) => m.cost != null && m.cost > 0)
      .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0] ?? null;

    // Category breakdown
    const byCategory = new Map<string, { count: number; total: number }>();
    for (const m of installed) {
      const e = byCategory.get(m.category) ?? { count: 0, total: 0 };
      byCategory.set(m.category, {
        count: e.count + 1,
        total: e.total + (m.cost ?? 0),
      });
    }
    const categoryEntries = [...byCategory.entries()]
      .sort((a, b) => b[1].total - a[1].total);
    const topCategory = categoryEntries[0] ?? null;

    // Cost per HP (added HP from mods / total spent)
    const hpGained = cars.reduce((sum, c) => {
      if (c.horsepower != null && c.stock_horsepower != null) {
        return sum + Math.max(0, c.horsepower - c.stock_horsepower);
      }
      return sum;
    }, 0);
    const costPerHp = hpGained > 0 ? totalSpent / hpGained : null;

    // Average mod cost
    const modsWithCost = installed.filter((m) => m.cost != null && m.cost > 0);
    const avgCost = modsWithCost.length > 0
      ? modsWithCost.reduce((s, m) => s + (m.cost ?? 0), 0) / modsWithCost.length
      : 0;

    // Monthly spend (last 12 months)
    const now = new Date();
    const monthBuckets: { key: string; label: string; spent: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        spent: 0,
        count: 0,
      });
    }
    for (const m of installed) {
      if (!m.install_date) continue;
      const d = new Date(m.install_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthBuckets.find((b) => b.key === key);
      if (bucket) {
        bucket.spent += m.cost ?? 0;
        bucket.count += 1;
      }
    }
    const maxMonthSpend = Math.max(1, ...monthBuckets.map((b) => b.spent));

    return {
      totalSpent,
      wishlistCost,
      biggest,
      categoryEntries,
      topCategory,
      hpGained,
      costPerHp,
      avgCost,
      monthBuckets,
      maxMonthSpend,
      installedCount: installed.length,
      wishlistCount: wishlist.length,
    };
  }, [mods, cars]);

  if (insights.installedCount === 0) {
    return (
      <div className="rounded-2xl p-8 text-center mt-8" style={{
        background: "rgba(15,12,30,0.5)",
        border: "1px solid rgba(168,85,247,0.2)",
      }}>
        <Wrench className="mx-auto mb-3" size={24} style={{ color: "rgba(200,180,240,0.4)" }} />
        <p className="text-sm font-bold text-white mb-1">No mods logged yet</p>
        <p className="text-xs" style={{ color: "rgba(200,180,240,0.55)" }}>
          Start logging mods in your garage to see cost insights.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-black tracking-tight mb-5 text-[var(--color-text-primary)]">
        Cost insights
      </h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<DollarSign size={16} />}
          label="Total invested"
          value={formatCurrency(insights.totalSpent)}
          accent="#f5d76e"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Avg per mod"
          value={formatCurrency(Math.round(insights.avgCost))}
          accent="#a855f7"
        />
        <StatCard
          icon={<Gauge size={16} />}
          label="Cost / HP"
          value={insights.costPerHp != null ? formatCurrency(Math.round(insights.costPerHp)) : "—"}
          sub={insights.hpGained > 0 ? `+${insights.hpGained} hp from mods` : "Log stock specs"}
          accent="#30d158"
        />
        <StatCard
          icon={<Crown size={16} />}
          label="Top category"
          value={insights.topCategory ? getCategoryLabel(insights.topCategory[0] as ModCategory) : "—"}
          sub={insights.topCategory ? formatCurrency(insights.topCategory[1].total) : undefined}
          accent={insights.topCategory ? getCategoryColor(insights.topCategory[0] as ModCategory) : "#a855f7"}
        />
      </div>

      {/* Biggest single mod + wishlist cost */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {insights.biggest && (
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(135deg, rgba(245,215,110,0.1) 0%, rgba(245,215,110,0.04) 100%)",
              border: "1px solid rgba(245,215,110,0.3)",
              boxShadow: "0 0 18px rgba(245,215,110,0.12)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Crown size={14} style={{ color: "#f5d76e" }} />
              <p
                className="text-[10px] font-bold uppercase"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em", color: "#f5d76e" }}
              >
                Biggest single mod
              </p>
            </div>
            <p className="text-lg font-black text-white mb-1 leading-tight">{insights.biggest.name}</p>
            <p className="text-2xl font-black" style={{ color: "#f5d76e" }}>
              {formatCurrency(insights.biggest.cost ?? 0)}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "rgba(200,180,240,0.55)" }}>
              {getCategoryLabel(insights.biggest.category)}
            </p>
          </div>
        )}

        <div
          className="rounded-2xl p-5"
          style={{
            background: "rgba(15,12,30,0.5)",
            border: "1px solid rgba(168,85,247,0.22)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <PieIcon size={14} style={{ color: "#c084fc" }} />
            <p
              className="text-[10px] font-bold uppercase"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em", color: "rgba(200,180,240,0.7)" }}
            >
              Wishlist pipeline
            </p>
          </div>
          <p className="text-2xl font-black text-white mb-1">
            {insights.wishlistCount} {insights.wishlistCount === 1 ? "item" : "items"}
          </p>
          <p className="text-sm" style={{ color: "rgba(200,180,240,0.7)" }}>
            {formatCurrency(insights.wishlistCost)} projected
          </p>
        </div>
      </div>

      {/* Category breakdown bars */}
      {insights.categoryEntries.length > 0 && (
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            background: "rgba(15,12,30,0.5)",
            border: "1px solid rgba(168,85,247,0.2)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase mb-4"
            style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em", color: "rgba(200,180,240,0.7)" }}
          >
            Spend by category
          </p>
          <div className="space-y-3">
            {insights.categoryEntries.map(([cat, data]) => {
              const color = getCategoryColor(cat as ModCategory);
              const pct = insights.totalSpent > 0 ? (data.total / insights.totalSpent) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                      {getCategoryLabel(cat as ModCategory)}
                    </span>
                    <span className="text-xs" style={{ color: "rgba(200,180,240,0.6)", fontFamily: "ui-monospace, monospace" }}>
                      {formatCurrency(data.total)} · {data.count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(168,85,247,0.1)" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: color,
                        boxShadow: `0 0 10px ${color}55`,
                        transition: "width 400ms ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 12-month spend timeline */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: "rgba(15,12,30,0.5)",
          border: "1px solid rgba(168,85,247,0.2)",
        }}
      >
        <p
          className="text-[10px] font-bold uppercase mb-4"
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em", color: "rgba(200,180,240,0.7)" }}
        >
          Last 12 months spend
        </p>
        <div className="flex items-end justify-between gap-1 h-32">
          {insights.monthBuckets.map((b) => {
            const h = b.spent > 0 ? Math.max(4, (b.spent / insights.maxMonthSpend) * 110) : 2;
            return (
              <div key={b.key} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div
                  className="w-full rounded-t transition-all relative"
                  style={{
                    height: h,
                    background:
                      b.spent > 0
                        ? "linear-gradient(180deg, #a855f7 0%, #7b4fd4 100%)"
                        : "rgba(168,85,247,0.18)",
                    boxShadow: b.spent > 0 ? "0 0 8px rgba(168,85,247,0.35)" : "none",
                  }}
                  title={`${b.label}: ${formatCurrency(b.spent)} (${b.count} mod${b.count === 1 ? "" : "s"})`}
                />
                <span
                  className="text-[9px]"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    color: "rgba(200,180,240,0.45)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(15,12,30,0.55)",
        border: "1px solid rgba(168,85,247,0.22)",
      }}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color: accent }}>
        {icon}
        <p
          className="text-[9px] font-bold uppercase"
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em" }}
        >
          {label}
        </p>
      </div>
      <p className="text-xl font-black text-white leading-tight">{value}</p>
      {sub && (
        <p className="text-[10px] mt-1" style={{ color: "rgba(200,180,240,0.55)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
