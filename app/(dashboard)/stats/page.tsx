import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BarChart2 } from "lucide-react";
import type { ModCategory, Car as CarType } from "@/lib/supabase/types";
import { StatsVehicleIntelligence } from "@/components/stats/stats-vehicle-intelligence";

export const metadata = { title: "Stats — MODVAULT" };

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: carsRaw } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  const cars = (carsRaw ?? []) as CarType[];

  const carIds = cars.map((c) => c.id);

  type ModRow = {
    id: string;
    car_id: string;
    name: string;
    category: ModCategory;
    cost: number | null;
    install_date: string | null;
    status: "installed" | "wishlist";
    notes: string | null;
    created_at: string;
  };

  let mods: ModRow[] = [];
  if (carIds.length) {
    const { data } = await supabase
      .from("mods")
      .select("id, car_id, name, category, cost, install_date, status, notes, created_at")
      .in("car_id", carIds)
      .order("install_date", { ascending: true, nullsFirst: false });
    mods = (data ?? []) as ModRow[];
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-5xl mx-auto pb-10">
      <div className="mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center flex-shrink-0">
            <BarChart2 size={17} className="text-[var(--color-accent-bright)]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">Build Stats</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
              Real vehicle intelligence — HP, torque, mod impact, wishlist projection
            </p>
          </div>
        </div>
      </div>

      <StatsVehicleIntelligence cars={cars} mods={mods} />
    </div>
  );
}
