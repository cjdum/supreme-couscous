import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BarChart2 } from "lucide-react";
import type { ModCategory, Car as CarType } from "@/lib/supabase/types";
import { StatsVehicleIntelligence } from "@/components/stats/stats-vehicle-intelligence";
import { ModInsights } from "@/components/stats/mod-insights";
import { MilestonesGrid } from "@/components/stats/milestones-grid";
import { PageContainer } from "@/components/ui/page-container";
import { computeMilestones } from "@/lib/milestones";

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
    is_diy: boolean;
    created_at: string;
  };

  let mods: ModRow[] = [];
  if (carIds.length) {
    const { data } = await supabase
      .from("mods")
      .select("id, car_id, name, category, cost, install_date, status, notes, is_diy, created_at")
      .in("car_id", carIds)
      .order("install_date", { ascending: true, nullsFirst: false });
    mods = (data ?? []) as ModRow[];
  }

  // Pixel cards count for milestones
  const { data: cardsRaw } = await supabase
    .from("pixel_cards")
    .select("id, car_id")
    .eq("user_id", user.id);
  const cardCount = (cardsRaw ?? []).length;

  // Forum activity for milestones
  const [postRes] = await Promise.all([
    supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const milestones = computeMilestones({
    cars,
    mods,
    cardCount,
    forumPostCount: postRes.count ?? 0,
  });

  return (
    <div className="min-h-dvh">
      <PageContainer maxWidth="7xl" className="pt-10 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center flex-shrink-0">
              <BarChart2 size={18} className="text-[var(--color-accent-bright)]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">Build Stats</h1>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                Cost insights, vehicle intelligence, and milestones
              </p>
            </div>
          </div>
        </div>

        {/* Mod cost insights */}
        <ModInsights mods={mods} cars={cars} />

        {/* Vehicle intelligence (existing) */}
        <div className="mt-10">
          <StatsVehicleIntelligence cars={cars} mods={mods} />
        </div>

        {/* Milestones */}
        <MilestonesGrid milestones={milestones} />
      </PageContainer>
    </div>
  );
}
