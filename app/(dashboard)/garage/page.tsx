import Link from "next/link";
import { Wrench, Ghost, MessageSquare } from "lucide-react";

// ---- Note on actions: /card-chat and /cards are folded into /home and /mint
// respectively. These Link hrefs point at the new locations.
import { createClient } from "@/lib/supabase/server";
import { getPrimaryCar } from "@/lib/supabase/get-primary-car";
import { OnboardingFlow } from "@/components/garage/onboarding-flow";
import { GarageHero } from "@/components/garage/garage-hero";
import { PageContainer } from "@/components/ui/page-container";

export const metadata = { title: "Garage — MODVAULT" };

export default async function GaragePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const primaryCar = await getPrimaryCar(supabase, user!.id);
  if (!primaryCar) {
    return <OnboardingFlow />;
  }

  // Fetch the cinematic background render and the card count in parallel —
  // they're independent.
  const [renderResult, cardCountResult] = await Promise.all([
    supabase
      .from("renders")
      .select("image_url")
      .eq("car_id", primaryCar.id)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("pixel_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("car_id", primaryCar.id),
  ]);
  const latestRenderUrl = (renderResult.data as { image_url: string | null } | null)?.image_url ?? null;
  const cardCount = cardCountResult.count;

  return (
    <div className="min-h-dvh animate-fade">
      {/* ── Cinematic hero ── */}
      <GarageHero
        car={primaryCar}
        isPrimary={true}
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
              href="/talk"
              className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
            >
              <div>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">Talk to Card</p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Chat with your living card</p>
              </div>
              <MessageSquare size={20} className="text-[var(--color-accent)] group-hover:scale-110 transition-transform flex-shrink-0" />
            </Link>

            <Link
              href="/mint"
              className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover group"
            >
              <div>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">Ghost Cards</p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {(cardCount ?? 0) === 0 ? "None minted yet" : `${cardCount} minted`}
                </p>
              </div>
              <Ghost size={20} className="text-[#fbbf24] group-hover:scale-110 transition-transform flex-shrink-0" />
            </Link>
          </div>
        </section>

      </PageContainer>
    </div>
  );
}
