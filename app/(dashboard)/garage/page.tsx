import Link from "next/link";
import { Wrench, Zap, Award, Plus, GalleryHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/garage/onboarding-flow";
import { AddCarButton } from "@/components/garage/add-car-button";
import { GarageHero } from "@/components/garage/garage-hero";
import { CarsRail } from "@/components/garage/cars-rail";
import { BuildTimeline } from "@/components/garage/build-timeline";
import { GarageStats } from "@/components/garage/garage-stats";
import { PageContainer } from "@/components/ui/page-container";
import { calculateBuildScore, LEVEL_COLORS } from "@/lib/build-score";
import type { Car as CarType, ModCategory } from "@/lib/supabase/types";
import type { MintedCard } from "@/lib/pixel-card";

export const metadata = { title: "Garage — MODVAULT" };

export default async function GaragePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", user!.id)
    .maybeSingle();
  const username = (profileRaw as { username: string } | null)?.username ?? "you";

  const { data: carsRaw } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  const cars = ((carsRaw ?? []) as CarType[]).sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return 0;
  });

  if (cars.length === 0) {
    return <OnboardingFlow />;
  }

  const carIds = cars.map((c) => c.id);
  type ModStat = {
    id: string;
    car_id: string;
    name: string;
    category: ModCategory;
    cost: number | null;
    status: string;
    install_date: string | null;
    created_at: string;
    notes: string | null;
    shop_name: string | null;
    is_diy: boolean;
  };
  let modStats: ModStat[] = [];
  if (carIds.length) {
    const { data } = await supabase
      .from("mods")
      .select("id, car_id, name, category, cost, status, install_date, created_at, notes, shop_name, is_diy")
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

  const primaryCar = cars.find((c) => c.is_primary) ?? cars[0];
  const primaryStats = statsMap.get(primaryCar.id) ?? { count: 0, total: 0 };
  const otherCars = cars.filter((c) => c.id !== primaryCar.id);

  // Latest render for the primary car (used as cinematic background)
  const { data: renderRaw } = await supabase
    .from("renders")
    .select("image_url")
    .eq("car_id", primaryCar.id)
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestRenderUrl = (renderRaw as { image_url: string | null } | null)?.image_url ?? null;

  const totalMods = Array.from(statsMap.values()).reduce((s, v) => s + v.count, 0);
  const totalInvested = Array.from(statsMap.values()).reduce((s, v) => s + v.total, 0);

  const buildScore = calculateBuildScore({
    cars: cars as Parameters<typeof calculateBuildScore>[0]["cars"],
    mods: modStats,
  });
  const levelColor = LEVEL_COLORS[buildScore.level];

  // Top category for primary car
  const primaryMods = modStats.filter((m) => m.car_id === primaryCar.id && m.status === "installed");
  const categoryTotals = primaryMods.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] ?? 0) + (m.cost ?? 0);
    return acc;
  }, {});
  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategory = (topCategoryEntry?.[0] as ModCategory | undefined) ?? null;

  // Top 3 mods by cost for share card
  const topMods = [...primaryMods]
    .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
    .slice(0, 3)
    .map((m) => ({ name: m.name, category: m.category, cost: m.cost }));

  // Build timeline mods (primary car only)
  const timelineMods = modStats
    .filter((m) => m.car_id === primaryCar.id && m.status === "installed")
    .map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      cost: m.cost,
      install_date: m.install_date,
      created_at: m.created_at,
      shop_name: m.shop_name,
      is_diy: m.is_diy,
      notes: m.notes,
    }));

  // ── All minted cards across the user (for the Mint CTA + CarsRail thumbnails) ──
  const { data: userCardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user!.id)
    .order("minted_at", { ascending: false });
  const userCards = (userCardsRaw ?? []) as MintedCard[];
  // Group cards by car_id for CarsRail thumbnails (newest → oldest already)
  const cardsByCarId = new Map<string, MintedCard[]>();
  for (const card of userCards) {
    if (!card.car_id) continue;
    const arr = cardsByCarId.get(card.car_id) ?? [];
    arr.push(card);
    cardsByCarId.set(card.car_id, arr);
  }

  return (
    <div className="min-h-dvh animate-fade">
      {/* ── Cinematic edge-to-edge hero ── */}
      <GarageHero
        car={primaryCar}
        modCount={primaryStats.count}
        totalInvested={primaryStats.total}
        isPrimary={!!cars.find((c) => c.is_primary)}
        username={username}
        buildScore={buildScore.score}
        buildLevel={buildScore.level}
        topCategory={topCategory}
        topMods={topMods}
        latestRenderUrl={latestRenderUrl}
      />

      {/* ── Stats + Build Score ── */}
      <PageContainer maxWidth="5xl" className="mt-10">
        <GarageStats
          buildScore={buildScore.score}
          buildLevel={buildScore.level}
          levelColor={levelColor}
          nextLevel={buildScore.nextLevel}
          nextThreshold={buildScore.nextThreshold ?? null}
          progress={buildScore.progress}
          carCount={cars.length}
          totalMods={totalMods}
          totalInvested={totalInvested}
        />

        {/* ── Build Timeline (primary car) ── */}
        {timelineMods.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Build Timeline</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Every mod, in order. Tap to expand.</p>
              </div>
              <Link
                href={`/garage/${primaryCar.id}`}
                className="text-xs font-semibold text-[var(--color-accent-bright)] hover:text-white transition-colors px-3 py-2"
              >
                View all
              </Link>
            </div>
            <BuildTimeline mods={timelineMods} />
          </section>
        )}

        {/* ── Quick actions ── */}
        {(() => {
          const primaryCardCount = cardsByCarId.get(primaryCar.id)?.length ?? 0;
          return (
            <section className="mt-10">
              {/* 2-col grid: Mint card spans full width on mobile, left col on desktop */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">

                {/* PRIMARY: Mint a Card — purple, spans 2 cols on mobile */}
                <Link
                  href={`/garage/${primaryCar.id}`}
                  className="col-span-2 lg:col-span-1 rounded-2xl p-5 flex items-center justify-between active:scale-[0.98] transition-all group"
                  style={{
                    background: "linear-gradient(135deg, #5a2da0 0%, #7b4fd4 50%, #a855f7 100%)",
                    border: "1px solid rgba(168,85,247,0.5)",
                    boxShadow: "0 4px 24px rgba(123,79,212,0.35)",
                  }}
                >
                  <div>
                    <p className="text-sm font-bold text-white">
                      {primaryCardCount === 0 ? "Mint a Card" : "Mint Another Card"}
                    </p>
                    <p className="text-[11px] text-white/60 mt-0.5">
                      {primaryCardCount === 0
                        ? "Freeze this build forever"
                        : `${primaryCardCount} card${primaryCardCount !== 1 ? "s" : ""} minted`}
                    </p>
                  </div>
                  <GalleryHorizontal size={22} className="text-white/70 group-hover:scale-110 transition-transform flex-shrink-0" />
                </Link>

                {/* Manage Build */}
                <Link
                  href={`/garage/${primaryCar.id}`}
                  className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">Manage Build</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Log mods &amp; track</p>
                  </div>
                  <Wrench size={20} className="text-[var(--color-accent)] group-hover:scale-110 transition-transform flex-shrink-0" />
                </Link>

                {/* AI Render */}
                <Link
                  href={`/visualizer?carId=${primaryCar.id}`}
                  className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">AI Render</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Visualize mods</p>
                  </div>
                  <Zap size={20} className="text-[var(--color-accent)] group-hover:scale-110 transition-transform flex-shrink-0" />
                </Link>

                {/* Stats */}
                <Link
                  href="/stats"
                  className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">Analytics</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Build insights</p>
                  </div>
                  <Award size={20} className="text-[#fbbf24] group-hover:scale-110 transition-transform flex-shrink-0" />
                </Link>

                {/* Profile */}
                <Link
                  href="/profile"
                  className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">Profile</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Score &amp; badges</p>
                  </div>
                  <Plus size={20} className="text-[var(--color-text-muted)] group-hover:scale-110 transition-transform flex-shrink-0" />
                </Link>

              </div>
            </section>
          );
        })()}

        {/* ── Other vehicles rail ── */}
        {otherCars.length > 0 && (
          <section className="mt-10">
            <div className="mb-4">
              <h2 className="text-lg font-bold tracking-tight">Other Vehicles</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Drag to reorder. {otherCars.length} {otherCars.length === 1 ? "car" : "cars"}.
              </p>
            </div>
            <CarsRail cars={otherCars} stats={statsMap} cardsByCarId={cardsByCarId} />
          </section>
        )}

        {/* Single-car CTA */}
        {cars.length === 1 && (
          <section className="mt-10">
            <AddCarButton asCard label="Add another vehicle" />
          </section>
        )}
      </PageContainer>

    </div>
  );
}
