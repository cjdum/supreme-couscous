import Link from "next/link";
import { Wrench, Award, GalleryHorizontal, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/garage/onboarding-flow";
import { AddCarButton } from "@/components/garage/add-car-button";
import { GarageHero } from "@/components/garage/garage-hero";
import { CarsRail } from "@/components/garage/cars-rail";
import { BuildTimeline } from "@/components/garage/build-timeline";
import { PageContainer } from "@/components/ui/page-container";
import { TradingCard } from "@/components/garage/trading-card";
import { QuickStatsWidget } from "@/components/garage/quick-stats-widget";
import { calculateBuildScore } from "@/lib/build-score";
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

  const totalInvested = Array.from(statsMap.values()).reduce((s, v) => s + v.total, 0);

  const buildScore = calculateBuildScore({
    cars: cars as Parameters<typeof calculateBuildScore>[0]["cars"],
    mods: modStats,
  });

  // Top mods by cost for share card
  const primaryMods = modStats.filter((m) => m.car_id === primaryCar.id && m.status === "installed");
  const categoryTotals = primaryMods.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] ?? 0) + (m.cost ?? 0);
    return acc;
  }, {});
  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategory = (topCategoryEntry?.[0] as ModCategory | undefined) ?? null;

  const topMods = [...primaryMods]
    .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
    .slice(0, 3)
    .map((m) => ({ name: m.name, category: m.category, cost: m.cost }));

  // Build timeline mods
  const timelineMods = modStats
    .filter((m) => m.car_id === primaryCar.id && m.status === "installed")
    .map((m) => ({
      id: m.id, name: m.name, category: m.category, cost: m.cost,
      install_date: m.install_date, created_at: m.created_at,
      shop_name: m.shop_name, is_diy: m.is_diy, notes: m.notes,
    }));

  // All minted cards
  const { data: userCardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user!.id)
    .order("minted_at", { ascending: false });
  const userCards = (userCardsRaw ?? []) as MintedCard[];

  // Group cards by car_id
  const cardsByCarId = new Map<string, MintedCard[]>();
  for (const card of userCards) {
    if (!card.car_id) continue;
    const arr = cardsByCarId.get(card.car_id) ?? [];
    arr.push(card);
    cardsByCarId.set(card.car_id, arr);
  }

  // Primary car's latest card
  const primaryLatestCard = cardsByCarId.get(primaryCar.id)?.[0] ?? null;
  const primaryCardCount = cardsByCarId.get(primaryCar.id)?.length ?? 0;
  const primaryCarLabel = `${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`;

  // Quick stats data
  const allInstalledMods = modStats.filter((m) => m.status === "installed");
  const mostRecentMod = allInstalledMods.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0] ?? null;

  const allWishlistMods = modStats.filter((m) => m.status === "wishlist");
  const nextPlannedMod = allWishlistMods[0] ?? null;

  const carLabelMap = new Map(cars.map((c) => [c.id, `${c.year} ${c.make} ${c.model}`]));
  const primaryModList = primaryMods.map((m) => m.name).join(", ") || "none";

  return (
    <div className="min-h-dvh animate-fade">
      {/* ── Cinematic hero ── */}
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

      <PageContainer maxWidth="7xl" className="mt-10">

        {/* ── Hero Card ── */}
        <section className="mb-10">
          {primaryLatestCard ? (
            <div className="flex flex-col items-center gap-5">
              {/* Floating card */}
              <Link href={`/c/${primaryLatestCard.id}`} style={{ textDecoration: "none" }}>
                <TradingCard
                  cardUrl={primaryLatestCard.pixel_card_url}
                  nickname={primaryLatestCard.nickname}
                  generatedAt={primaryLatestCard.minted_at}
                  hp={primaryLatestCard.hp}
                  modCount={primaryLatestCard.mod_count}
                  buildScore={primaryLatestCard.car_snapshot.build_score}
                  vinVerified={primaryLatestCard.car_snapshot.vin_verified}
                  cardNumber={primaryLatestCard.card_number}
                  era={primaryLatestCard.era}
                  rarity={primaryLatestCard.rarity}
                  flavorText={primaryLatestCard.flavor_text}
                  occasion={primaryLatestCard.occasion}
                  mods={primaryLatestCard.car_snapshot.mods ?? []}
                  modsDetail={primaryLatestCard.car_snapshot.mods_detail}
                  torque={primaryLatestCard.car_snapshot.torque ?? null}
                  zeroToSixty={primaryLatestCard.car_snapshot.zero_to_sixty ?? null}
                  totalInvested={primaryLatestCard.car_snapshot.total_invested ?? null}
                  carLabel={primaryCarLabel}
                  scale={1.0}
                  idle
                  interactive
                />
              </Link>
              <div className="text-center">
                <p
                  style={{
                    fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800,
                    letterSpacing: "0.18em", textTransform: "uppercase",
                    color: "rgba(200,180,240,0.45)",
                  }}
                >
                  {primaryCarLabel} · {primaryCardCount} {primaryCardCount === 1 ? "card" : "cards"} minted
                </p>
                <Link
                  href="/cards"
                  style={{
                    display: "inline-block", marginTop: 6,
                    fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "rgba(168,85,247,0.7)",
                    textDecoration: "none",
                  }}
                >
                  View collection →
                </Link>
              </div>
            </div>
          ) : (
            /* No card yet — quiet nudge */
            <div
              style={{
                width: 280, height: 240,
                borderRadius: 14,
                background: "linear-gradient(158deg, rgba(123,79,212,0.08) 0%, rgba(168,85,247,0.05) 100%)",
                border: "1px dashed rgba(123,79,212,0.25)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, margin: "0 auto",
              }}
            >
              <GalleryHorizontal size={24} style={{ color: "rgba(168,85,247,0.35)" }} />
              <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "rgba(200,180,240,0.5)", letterSpacing: "0.06em", textAlign: "center", margin: 0 }}>
                No cards yet
              </p>
              <Link
                href="/mint"
                style={{
                  fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 700,
                  color: "rgba(168,85,247,0.6)", textDecoration: "none", letterSpacing: "0.08em",
                }}
              >
                Go to Mint →
              </Link>
            </div>
          )}
        </section>

        {/* ── Quick Stats + Quick Actions ── */}
        <section className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-5">
            {/* Quick Stats */}
            <QuickStatsWidget
              totalInvested={totalInvested}
              mostRecentMod={mostRecentMod ? {
                name: mostRecentMod.name,
                carLabel: carLabelMap.get(mostRecentMod.car_id) ?? primaryCarLabel,
                createdAt: mostRecentMod.created_at,
              } : null}
              nextPlannedMod={nextPlannedMod ? {
                name: nextPlannedMod.name,
                carLabel: carLabelMap.get(nextPlannedMod.car_id) ?? primaryCarLabel,
              } : null}
              buildScore={buildScore.score}
              buildLevel={buildScore.level}
              nextThreshold={buildScore.nextThreshold ?? null}
              progress={buildScore.progress}
              primaryCarId={primaryCar.id}
              primaryCarLabel={primaryCarLabel}
              primaryCarModList={primaryModList}
            />

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 content-start">
              <Link
                href={`/garage/${primaryCar.id}#mods`}
                className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">Add a Mod</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Log an install</p>
                </div>
                <Wrench size={20} className="text-[var(--color-accent)] group-hover:scale-110 transition-transform flex-shrink-0" />
              </Link>

              <Link
                href={`/chat?carId=${primaryCar.id}`}
                className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">Ask VAULT AI</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">What&apos;s next?</p>
                </div>
                <MessageSquare size={20} className="text-[var(--color-accent)] group-hover:scale-110 transition-transform flex-shrink-0" />
              </Link>

              <Link
                href="/cards"
                className="col-span-2 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">My Cards</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {userCards.length === 0 ? "None minted yet — go to Mint" : `${userCards.length} minted`}
                  </p>
                </div>
                <Award size={20} className="text-[#fbbf24] group-hover:scale-110 transition-transform flex-shrink-0" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Build Timeline ── */}
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

        {/* Always-visible Add Vehicle CTA — shown regardless of car count */}
        <section className="mt-10">
          <AddCarButton asCard label={cars.length === 1 ? "Add another vehicle" : "Add a vehicle"} />
        </section>
      </PageContainer>
    </div>
  );
}
