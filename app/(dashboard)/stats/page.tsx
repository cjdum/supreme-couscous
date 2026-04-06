import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate, MOD_CATEGORIES } from "@/lib/utils";
import type { ModCategory, Car } from "@/lib/supabase/types";
import { SpendingChart } from "@/components/mods/spending-chart";
import { TimelineView } from "@/components/mods/timeline-view";
import { CategoryBadge } from "@/components/ui/badge";
import { DollarSign, Wrench, Clock, Star, TrendingUp, Car as CarIcon } from "lucide-react";

export const metadata = { title: "Stats — ModVault" };

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, make, model, year, nickname")
    .eq("user_id", user.id);
  const cars = (carsRaw ?? []) as Pick<Car, "id" | "make" | "model" | "year" | "nickname">[];

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
      .order("created_at", { ascending: false });
    mods = (data ?? []) as ModRow[];
  }

  const installed = mods.filter((m) => m.status === "installed");
  const wishlist = mods.filter((m) => m.status === "wishlist");
  const totalSpent = installed.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const wishlistValue = wishlist.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  // Category totals
  const categoryTotals: Record<string, number> = {};
  for (const mod of installed) {
    categoryTotals[mod.category] = (categoryTotals[mod.category] ?? 0) + (mod.cost ?? 0);
  }
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  // Per-car totals
  const carTotals: Record<string, number> = {};
  for (const mod of installed) {
    carTotals[mod.car_id] = (carTotals[mod.car_id] ?? 0) + (mod.cost ?? 0);
  }

  const chartData = MOD_CATEGORIES.filter((c) => categoryTotals[c.value] > 0).map((c) => ({
    name: c.label,
    value: categoryTotals[c.value] ?? 0,
    color: c.color,
  }));

  // Summary card data
  const mostExpensiveMod = [...installed].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0];
  const newestMod = installed[0]; // already sorted by created_at desc
  const nextPlanned = [...wishlist].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0];

  const isEmpty = installed.length === 0 && wishlist.length === 0;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Stats & Analytics</h1>

      {isEmpty ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={24} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="font-semibold text-[var(--color-text-secondary)]">No data yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Log your first mod to start seeing stats
          </p>
        </div>
      ) : (
        <>
          {/* ── KPI grid ── */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] mb-2">
                <DollarSign size={13} />
                <p className="text-xs font-medium uppercase tracking-wider">Total invested</p>
              </div>
              <p className="text-2xl font-bold text-[var(--color-accent-bright)]">
                {formatCurrency(totalSpent)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] mb-2">
                <Wrench size={13} />
                <p className="text-xs font-medium uppercase tracking-wider">Mods installed</p>
              </div>
              <p className="text-2xl font-bold">{installed.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] mb-2">
                <Star size={13} />
                <p className="text-xs font-medium uppercase tracking-wider">Wishlist value</p>
              </div>
              <p className="text-2xl font-bold text-[var(--color-warning)]">
                {formatCurrency(wishlistValue)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] mb-2">
                <CarIcon size={13} />
                <p className="text-xs font-medium uppercase tracking-wider">Vehicles</p>
              </div>
              <p className="text-2xl font-bold">{cars.length}</p>
            </div>
          </div>

          {/* ── Summary cards ── */}
          {(mostExpensiveMod || newestMod || nextPlanned) && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] divide-y divide-[var(--color-border)] mb-5">
              {mostExpensiveMod && (
                <div className="flex items-center justify-between px-4 py-3.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(239,68,68,0.1)] flex items-center justify-center shrink-0">
                      <TrendingUp size={14} className="text-[var(--color-danger)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                        Most expensive
                      </p>
                      <p className="text-sm font-semibold truncate">{mostExpensiveMod.name}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[var(--color-danger)]">
                      {formatCurrency(mostExpensiveMod.cost ?? 0)}
                    </p>
                    <CategoryBadge category={mostExpensiveMod.category} className="text-[9px]" />
                  </div>
                </div>
              )}

              {newestMod && (
                <div className="flex items-center justify-between px-4 py-3.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(34,197,94,0.1)] flex items-center justify-center shrink-0">
                      <Clock size={14} className="text-[var(--color-success)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                        Newest mod
                      </p>
                      <p className="text-sm font-semibold truncate">{newestMod.name}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {newestMod.install_date && (
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {formatDate(newestMod.install_date)}
                      </p>
                    )}
                    <CategoryBadge category={newestMod.category} className="text-[9px]" />
                  </div>
                </div>
              )}

              {nextPlanned && (
                <div className="flex items-center justify-between px-4 py-3.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(245,158,11,0.1)] flex items-center justify-center shrink-0">
                      <Star size={14} className="text-[var(--color-warning)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                        Next planned
                      </p>
                      <p className="text-sm font-semibold truncate">{nextPlanned.name}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {nextPlanned.cost != null && (
                      <p className="text-sm font-bold text-[var(--color-warning)]">
                        {formatCurrency(nextPlanned.cost)}
                      </p>
                    )}
                    <CategoryBadge category={nextPlanned.category} className="text-[9px]" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Top category highlight ── */}
          {topCategory && (
            <div className="rounded-2xl border border-[rgba(59,130,246,0.2)] bg-[var(--color-accent-muted)] p-4 mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-accent-bright)] mb-1 font-medium uppercase tracking-wider">
                  Top spend category
                </p>
                <p className="font-bold text-lg capitalize">{topCategory[0]}</p>
              </div>
              <p className="text-2xl font-bold text-[var(--color-accent-bright)]">
                {formatCurrency(topCategory[1])}
              </p>
            </div>
          )}

          {/* ── Spend by category chart ── */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 mb-5">
              <h2 className="text-sm font-semibold mb-4">Spend by Category</h2>
              <SpendingChart data={chartData} total={totalSpent} />
            </div>
          )}

          {/* ── Per-car breakdown ── */}
          {cars.length > 1 && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 mb-5">
              <h2 className="text-sm font-semibold mb-4">By Vehicle</h2>
              <div className="space-y-3.5">
                {cars.map((car) => {
                  const spent = carTotals[car.id] ?? 0;
                  const pct = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
                  return (
                    <div key={car.id}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[var(--color-text-secondary)]">
                          {car.nickname ? (
                            <>
                              <span className="font-medium text-[var(--color-text-primary)]">
                                {car.nickname}
                              </span>{" "}
                              · {car.year} {car.make} {car.model}
                            </>
                          ) : (
                            `${car.year} ${car.make} ${car.model}`
                          )}
                        </span>
                        <span className="font-semibold text-[var(--color-accent-bright)]">
                          {formatCurrency(spent)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Build timeline ── */}
          {installed.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
              <h2 className="text-sm font-semibold mb-4">Build Timeline</h2>
              <TimelineView mods={installed} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
