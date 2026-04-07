import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TrendingUp, Star, Calendar, BarChart2, Users } from "lucide-react";
import { formatCurrency, formatDate, getCategoryColor, getCategoryLabel } from "@/lib/utils";
import type { ModCategory, Car as CarType } from "@/lib/supabase/types";
import { CategoryBadge } from "@/components/ui/badge";
import { StatsCharts } from "@/components/stats/stats-charts";

export const metadata = { title: "Stats — MODVAULT" };

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, make, model, year, nickname, cover_image_url")
    .eq("user_id", user.id);
  const cars = (carsRaw ?? []) as Pick<CarType, "id" | "make" | "model" | "year" | "nickname" | "cover_image_url">[];

  const carIds = cars.map((c) => c.id);

  type ModRow = {
    id: string;
    car_id: string;
    name: string;
    category: ModCategory;
    cost: number | null;
    install_date: string | null;
    status: string;
    created_at: string;
  };

  let mods: ModRow[] = [];
  if (carIds.length) {
    const { data } = await supabase
      .from("mods")
      .select("id, car_id, name, category, cost, install_date, status, created_at")
      .in("car_id", carIds)
      .order("created_at", { ascending: true });
    mods = (data ?? []) as ModRow[];
  }

  const installed = mods.filter((m) => m.status === "installed");
  const wishlist = mods.filter((m) => m.status === "wishlist");
  const totalSpent = installed.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  // Per-category totals
  const categoryAgg = new Map<ModCategory, { total: number; count: number }>();
  for (const mod of installed) {
    const existing = categoryAgg.get(mod.category) ?? { total: 0, count: 0 };
    categoryAgg.set(mod.category, {
      total: existing.total + (mod.cost ?? 0),
      count: existing.count + 1,
    });
  }
  const categoryTotals = Array.from(categoryAgg.entries()).map(([category, data]) => ({
    category,
    total: data.total,
    count: data.count,
  }));

  // Per-car totals
  const carTotals: Record<string, number> = {};
  for (const mod of installed) {
    carTotals[mod.car_id] = (carTotals[mod.car_id] ?? 0) + (mod.cost ?? 0);
  }

  // Monthly data
  const monthlyMap = new Map<string, { total: number; count: number }>();
  for (const mod of installed) {
    const date = mod.install_date ?? mod.created_at;
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyMap.get(key) ?? { total: 0, count: 0 };
    monthlyMap.set(key, {
      total: existing.total + (mod.cost ?? 0),
      count: existing.count + 1,
    });
  }

  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<{ month: string; invested: number; cumulative: number; count: number }[]>((acc, [key, data]) => {
      const [year, month] = key.split("-");
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const last = acc[acc.length - 1];
      acc.push({
        month: monthName,
        invested: data.total,
        cumulative: (last?.cumulative ?? 0) + data.total,
        count: data.count,
      });
      return acc;
    }, []);

  // Best month
  const bestMonth = monthlyData.length > 0
    ? monthlyData.reduce((best, curr) => (curr.invested > best.invested ? curr : best), monthlyData[0])
    : null;

  // Average per month
  const totalMonths = monthlyData.length || 1;
  const averagePerMonth = totalSpent / totalMonths;

  // Top category
  const topCategory = categoryTotals.length > 0
    ? categoryTotals.reduce((a, b) => (a.total > b.total ? a : b))
    : null;

  // Summary cards
  const mostExpensiveMod = [...installed].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0];
  const newestMod = [...installed].sort((a, b) =>
    new Date(b.install_date ?? b.created_at).getTime() - new Date(a.install_date ?? a.created_at).getTime()
  )[0];
  const nextPlanned = [...wishlist].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0];

  const isEmpty = installed.length === 0;

  // Mock community average (in a real app, this would aggregate from all users)
  // For now we use ~$3,500 as a sensible default to compare against
  const COMMUNITY_AVG_INVESTED = 3500;
  const COMMUNITY_AVG_MODS = 8;
  const investedDiff = totalSpent - COMMUNITY_AVG_INVESTED;
  const modCountDiff = installed.length - COMMUNITY_AVG_MODS;

  return (
    <div className="px-5 sm:px-8 py-6 max-w-5xl mx-auto pb-10">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center">
            <BarChart2 size={17} className="text-[var(--color-accent-bright)]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Stats & Analytics</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Your build, by the numbers</p>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={26} className="text-[var(--color-text-disabled)]" />
          </div>
          <p className="font-bold text-[var(--color-text-secondary)] text-base">No data yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1.5 max-w-xs mx-auto">
            Log your first mod to start seeing stats
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Charts */}
          <StatsCharts
            monthlyData={monthlyData}
            categoryTotals={categoryTotals}
            totalInvested={totalSpent}
            modCount={installed.length}
            bestMonth={bestMonth ? { month: bestMonth.month, total: bestMonth.invested } : null}
            averagePerMonth={averagePerMonth}
          />

          {/* Summary highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Favorite category */}
            {topCategory && (
              <SummaryCard
                icon={<Star size={14} />}
                accent={getCategoryColor(topCategory.category)}
                label="Favorite Category"
                value={getCategoryLabel(topCategory.category)}
                meta={`${formatCurrency(topCategory.total)} · ${topCategory.count} ${topCategory.count === 1 ? "mod" : "mods"}`}
              />
            )}
            {/* Most expensive */}
            {mostExpensiveMod && (
              <SummaryCard
                icon={<TrendingUp size={14} />}
                accent="#ff453a"
                label="Most Expensive Mod"
                value={mostExpensiveMod.name}
                meta={mostExpensiveMod.cost ? formatCurrency(mostExpensiveMod.cost) : "—"}
                badge={<CategoryBadge category={mostExpensiveMod.category} className="text-[9px]" />}
              />
            )}
            {/* Newest mod */}
            {newestMod && (
              <SummaryCard
                icon={<Calendar size={14} />}
                accent="#30d158"
                label="Most Recent"
                value={newestMod.name}
                meta={newestMod.install_date ? formatDate(newestMod.install_date) : "Recently"}
                badge={<CategoryBadge category={newestMod.category} className="text-[9px]" />}
              />
            )}
          </div>

          {/* Per-car breakdown */}
          {cars.length > 1 && (
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
              <h2 className="text-base font-bold tracking-tight mb-5">Spending by Vehicle</h2>
              <div className="space-y-4">
                {cars.map((car) => {
                  const spent = carTotals[car.id] ?? 0;
                  const pct = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
                  return (
                    <div key={car.id} className="flex items-center gap-4">
                      {car.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={car.cover_image_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-elevated)] flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-bold text-white truncate">
                            {car.year} {car.make} {car.model}
                          </span>
                          <span className="text-sm font-bold text-[var(--color-accent-bright)] tabular ml-2">{formatCurrency(spent)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] transition-all duration-1000"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Community comparison */}
          <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users size={15} className="text-[var(--color-accent-bright)]" />
              <h2 className="text-base font-bold tracking-tight">vs. Community Average</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CompareCard
                label="Total Invested"
                you={formatCurrency(totalSpent)}
                them={formatCurrency(COMMUNITY_AVG_INVESTED)}
                diff={investedDiff}
                formatter={(n) => formatCurrency(Math.abs(Math.round(n)))}
              />
              <CompareCard
                label="Mods Installed"
                you={String(installed.length)}
                them={String(COMMUNITY_AVG_MODS)}
                diff={modCountDiff}
                formatter={(n) => Math.abs(Math.round(n)).toString()}
              />
            </div>
            <p className="mt-4 text-[10px] text-[var(--color-text-muted)] text-center">
              Community averages are illustrative — based on a typical enthusiast build.
            </p>
          </div>

          {/* Next planned */}
          {nextPlanned && (
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[rgba(255,159,10,0.25)] p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-muted)] flex items-center justify-center flex-shrink-0">
                    <Star size={16} className="text-[var(--color-warning)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Next Planned</p>
                    <p className="text-sm font-bold truncate">{nextPlanned.name}</p>
                  </div>
                </div>
                {nextPlanned.cost != null && (
                  <p className="text-base font-black text-[var(--color-warning)] tabular">{formatCurrency(nextPlanned.cost)}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  accent,
  label,
  value,
  meta,
  badge,
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  meta: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}15`, color: accent }}
        >
          {icon}
        </div>
        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-base font-bold leading-tight line-clamp-2 mb-2">{value}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-secondary)] font-semibold tabular">{meta}</p>
        {badge}
      </div>
    </div>
  );
}

function CompareCard({
  label,
  you,
  them,
  diff,
  formatter,
}: {
  label: string;
  you: string;
  them: string;
  diff: number;
  formatter: (n: number) => string;
}) {
  const isAbove = diff > 0;
  return (
    <div className="rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-4">
      <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">{label}</p>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] font-bold">YOU</p>
          <p className="text-xl font-black tabular text-white">{you}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[var(--color-text-muted)] font-bold">AVERAGE</p>
          <p className="text-base font-bold tabular text-[var(--color-text-secondary)]">{them}</p>
        </div>
      </div>
      <div
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: isAbove ? "#30d158" : diff < 0 ? "#ff9f0a" : "#555" }}
      >
        {diff === 0 ? "On par" : `${isAbove ? "+" : "-"}${formatter(diff)} ${isAbove ? "above" : "below"}`}
      </div>
    </div>
  );
}
