import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, MOD_CATEGORIES } from "@/lib/utils";
import type { ModCategory, Car } from "@/lib/supabase/types";
import { SpendingChart } from "@/components/mods/spending-chart";
import { TimelineView } from "@/components/mods/timeline-view";

export const metadata = { title: "Stats" };

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, make, model, year, nickname")
    .eq("user_id", user.id);
  const cars = (carsRaw ?? []) as Pick<Car, "id" | "make" | "model" | "year" | "nickname">[];

  const carIds = (cars ?? []).map((c) => c.id);

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
      .in("car_id", carIds);
    mods = (data ?? []) as ModRow[];
  }

  const installed = mods.filter((m) => m.status === "installed");
  const wishlist = mods.filter((m) => m.status === "wishlist");
  const totalSpent = installed.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const wishlistValue = wishlist.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  // Per-category totals
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

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Stats & Analytics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Total invested</p>
          <p className="text-2xl font-bold text-[var(--color-accent-bright)]">
            {formatCurrency(totalSpent)}
          </p>
        </div>
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Mods installed</p>
          <p className="text-2xl font-bold">{installed.length}</p>
        </div>
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Wishlist value</p>
          <p className="text-2xl font-bold text-[var(--color-warning)]">
            {formatCurrency(wishlistValue)}
          </p>
        </div>
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Vehicles</p>
          <p className="text-2xl font-bold">{cars?.length ?? 0}</p>
        </div>
      </div>

      {/* Top category */}
      {topCategory && (
        <div className="rounded-[14px] border border-[rgba(59,130,246,0.2)] bg-[var(--color-accent-muted)] p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--color-accent-bright)] mb-1">Top spend category</p>
            <p className="font-bold text-lg capitalize">{topCategory[0]}</p>
          </div>
          <p className="text-xl font-bold text-[var(--color-accent-bright)]">
            {formatCurrency(topCategory[1])}
          </p>
        </div>
      )}

      {/* Spend by category chart */}
      {chartData.length > 0 && (
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4">Spend by Category</h2>
          <SpendingChart data={chartData} total={totalSpent} />
        </div>
      )}

      {/* Per-car breakdown */}
      {(cars?.length ?? 0) > 1 && (
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4">By Vehicle</h2>
          <div className="space-y-3">
            {(cars ?? []).map((car) => {
              const spent = carTotals[car.id] ?? 0;
              const pct = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
              return (
                <div key={car.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[var(--color-text-secondary)]">
                      {car.year} {car.make} {car.model}
                    </span>
                    <span className="font-medium text-[var(--color-accent-bright)]">
                      {formatCurrency(spent)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      {installed.length > 0 && (
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
          <h2 className="text-sm font-semibold mb-4">Build Timeline</h2>
          <TimelineView mods={installed} />
        </div>
      )}

      {installed.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--color-text-muted)] text-sm">
            Log your first mod to see stats
          </p>
        </div>
      )}
    </div>
  );
}
