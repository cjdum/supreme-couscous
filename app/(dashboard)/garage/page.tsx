import { Car } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CarCard } from "@/components/garage/car-card";
import { EmptyState } from "@/components/ui/loading";
import { AddCarButton } from "@/components/garage/add-car-button";
import type { Car as CarType } from "@/lib/supabase/types";

export const metadata = { title: "Garage" };

export default async function GaragePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: carsRaw } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  const cars = (carsRaw ?? []) as CarType[];

  // Fetch mod counts and total costs per car
  const carIds = (cars ?? []).map((c) => c.id);
  type ModStat = { car_id: string; cost: number | null; status: string };
  let modStats: ModStat[] = [];
  if (carIds.length) {
    const { data } = await supabase
      .from("mods")
      .select("car_id, cost, status")
      .in("car_id", carIds);
    modStats = (data ?? []) as ModStat[];
  }

  const statsMap = new Map<string, { count: number; total: number }>();
  for (const mod of modStats) {
    const existing = statsMap.get(mod.car_id) ?? { count: 0, total: 0 };
    statsMap.set(mod.car_id, {
      count: existing.count + (mod.status === "installed" ? 1 : 0),
      total: existing.total + (mod.status === "installed" ? (mod.cost ?? 0) : 0),
    });
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto lg:max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">My Garage</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {cars?.length ?? 0} {(cars?.length ?? 0) === 1 ? "vehicle" : "vehicles"}
          </p>
        </div>
        <AddCarButton />
      </div>

      {/* Cars grid */}
      {cars.length === 0 ? (
        <EmptyState
          icon={<Car size={32} />}
          title="Your garage is empty"
          description="Add your first car to start tracking mods, costs, and your build history."
          action={<AddCarButton label="Add your first car" />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              modCount={statsMap.get(car.id)?.count ?? 0}
              totalSpent={statsMap.get(car.id)?.total ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
