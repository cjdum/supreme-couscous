import Link from "next/link";
import { Wrench, Award, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/garage/onboarding-flow";
import { GarageHero } from "@/components/garage/garage-hero";
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

  // Latest render for the primary car (cinematic background)
  const { data: renderRaw } = await supabase
    .from("renders")
    .select("image_url")
    .eq("car_id", primaryCar.id)
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestRenderUrl = (renderRaw as { image_url: string | null } | null)?.image_url ?? null;

  // Card count for the action tiles
  const { count: cardCount } = await supabase
    .from("pixel_cards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id);
  const userCards: MintedCard[] = []; // unused below but type kept for minimal diff

  return (
    <div className="min-h-dvh animate-fade">
      {/* ── Cinematic hero ── */}
      <GarageHero
        car={primaryCar}
        isPrimary={!!cars.find((c) => c.is_primary)}
        latestRenderUrl={latestRenderUrl}
      />

      <PageContainer maxWidth="7xl" className="mt-10">

        {/* ── Quick actions: car-centric, no card on this page ── */}
        <section>
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
                  {(cardCount ?? 0) === 0 ? "None minted yet" : `${cardCount} minted`}
                </p>
              </div>
              <Award size={20} className="text-[#fbbf24] group-hover:scale-110 transition-transform flex-shrink-0" />
            </Link>
          </div>
        </section>
      </PageContainer>
    </div>
  );
}
