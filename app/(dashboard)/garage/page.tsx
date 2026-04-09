import Link from "next/link";
import { Wrench, Award, GalleryHorizontal, MessageSquare } from "lucide-react";
import { HeroCardViewer } from "@/components/garage/hero-card-viewer";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/garage/onboarding-flow";
import { AddCarButton } from "@/components/garage/add-car-button";
import { GarageHero } from "@/components/garage/garage-hero";
import { CarsRail } from "@/components/garage/cars-rail";
import { PageContainer } from "@/components/ui/page-container";
import type { Car as CarType } from "@/lib/supabase/types";
import type { MintedCard } from "@/lib/pixel-card";

export const metadata = { title: "Garage — MODVAULT" };

export default async function GaragePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const primaryCar = cars.find((c) => c.is_primary) ?? cars[0];
  const otherCars = cars.filter((c) => c.id !== primaryCar.id);

  // Per-car installed-mod counts (used only by the "other vehicles" rail for a
  // quiet chip — no money, no categories, just a count).
  const carIds = cars.map((c) => c.id);
  const statsMap = new Map<string, { count: number; total: number }>();
  if (carIds.length) {
    const { data } = await supabase
      .from("mods")
      .select("car_id, status")
      .in("car_id", carIds);
    for (const row of (data ?? []) as { car_id: string; status: string }[]) {
      if (row.status !== "installed") continue;
      const existing = statsMap.get(row.car_id) ?? { count: 0, total: 0 };
      statsMap.set(row.car_id, { count: existing.count + 1, total: 0 });
    }
  }

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

  // All minted cards (for card counts and the hero card for the primary car)
  const { data: userCardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user!.id)
    .order("minted_at", { ascending: false });
  const userCards = (userCardsRaw ?? []) as MintedCard[];

  const cardsByCarId = new Map<string, MintedCard[]>();
  for (const card of userCards) {
    if (!card.car_id) continue;
    const arr = cardsByCarId.get(card.car_id) ?? [];
    arr.push(card);
    cardsByCarId.set(card.car_id, arr);
  }

  const primaryLatestCard = cardsByCarId.get(primaryCar.id)?.[0] ?? null;
  const primaryCardCount = cardsByCarId.get(primaryCar.id)?.length ?? 0;
  const primaryCarLabel = `${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`;

  return (
    <div className="min-h-dvh animate-fade">
      {/* ── Cinematic hero ── */}
      <GarageHero
        car={primaryCar}
        isPrimary={!!cars.find((c) => c.is_primary)}
        latestRenderUrl={latestRenderUrl}
      />

      <PageContainer maxWidth="7xl" className="mt-10">

        {/* ── Hero Card ── */}
        <section className="mb-10">
          {primaryLatestCard ? (
            <div className="flex flex-col items-center gap-5">
              {/* Click opens modal viewer — no navigation away */}
              <HeroCardViewer card={primaryLatestCard} carLabel={primaryCarLabel} scale={1.0} />
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

        {/* ── Quick actions (3 cards, no stats) ── */}
        <section className="mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
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
              href="/card-chat"
              className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
            >
              <div>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">Talk to Card</p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Chat with your living card</p>
              </div>
              <MessageSquare size={20} className="text-[var(--color-accent)] group-hover:scale-110 transition-transform flex-shrink-0" />
            </Link>

            <Link
              href="/cards"
              className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
            >
              <div>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">Collection</p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {userCards.length === 0 ? "None minted yet" : `${userCards.length} minted`}
                </p>
              </div>
              <Award size={20} className="text-[#fbbf24] group-hover:scale-110 transition-transform flex-shrink-0" />
            </Link>
          </div>
        </section>

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
