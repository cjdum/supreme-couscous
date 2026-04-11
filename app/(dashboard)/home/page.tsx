import Link from "next/link";
import { Sparkles, Car } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { HomeHero } from "@/components/garage/home-hero";
import { PageContainer } from "@/components/ui/page-container";
import type { Car as CarType, Mod } from "@/lib/supabase/types";
import type { MintedCard } from "@/lib/pixel-card";

export const metadata = { title: "Home — MODVAULT" };

export default async function HomePage() {
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

  // Primary car
  const { data: carsRaw } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  const cars = (carsRaw ?? []) as CarType[];
  const primaryCar = cars.find((c) => c.is_primary) ?? cars[0] ?? null;

  // No cars yet — push to garage onboarding
  if (!primaryCar) {
    return (
      <div className="min-h-dvh animate-fade flex items-center justify-center px-5">
        <div className="max-w-md text-center">
          <div
            aria-hidden
            className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(123,79,212,0.25) 0%, rgba(168,85,247,0.15) 100%)",
              border: "1px solid rgba(168,85,247,0.4)",
              boxShadow: "0 0 24px rgba(168,85,247,0.35)",
            }}
          >
            <Car size={26} style={{ color: "#e9d5ff" }} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-2">
            Welcome, {username}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            Add your car to start building. Your living card is waiting.
          </p>
          <Link
            href="/garage"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-xl font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
              color: "#fff",
              boxShadow: "0 6px 24px rgba(168,85,247,0.45)",
            }}
          >
            Add your car
          </Link>
        </div>
      </div>
    );
  }

  const primaryCarLabel = `${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`;

  // Latest living card for the primary car
  const { data: cardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user!.id)
    .eq("car_id", primaryCar.id)
    .order("minted_at", { ascending: false });
  const primaryCards = (cardsRaw ?? []) as MintedCard[];
  const totalCards = primaryCards.length;
  const latestCard = primaryCards[0] ?? null;
  const previousCardFlavourText = (primaryCards[1] as MintedCard & { flavor_text?: string | null } | undefined)?.flavor_text ?? null;

  // Mods for quick info cards
  const { data: modsRaw } = await supabase
    .from("mods")
    .select("*")
    .eq("user_id", user!.id)
    .eq("car_id", primaryCar.id);
  const allMods = (modsRaw ?? []) as Mod[];
  const installedMods = allMods.filter((m) => m.status === "installed");
  const wishlistMods = allMods.filter((m) => m.status === "wishlist");

  // Stats
  const totalInvested = installedMods.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const wishlistCost = wishlistMods.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  // Biggest mod
  const biggestMod = installedMods.reduce<Mod | null>(
    (acc, m) => (m.cost != null && (acc == null || (acc.cost ?? 0) < m.cost) ? m : acc),
    null,
  );

  // Most recent mod
  const latestMod = installedMods
    .slice()
    .sort((a, b) => new Date(b.install_date ?? b.created_at).getTime() - new Date(a.install_date ?? a.created_at).getTime())[0]
    ?? null;

  // Days since minted
  const daysSinceMint = latestCard
    ? Math.max(0, Math.floor((Date.now() - new Date(latestCard.minted_at).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // No card yet state
  if (!latestCard) {
    return (
      <div className="min-h-dvh animate-fade relative overflow-hidden flex flex-col">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse 70% 50% at 50% 10%, rgba(168,85,247,0.22) 0%, transparent 60%)",
              "radial-gradient(ellipse 60% 40% at 20% 80%, rgba(91,33,182,0.18) 0%, transparent 60%)",
            ].join(", "),
          }}
        />

        <PageContainer maxWidth="6xl" className="relative z-10 flex-1 flex flex-col justify-center items-center pt-4 pb-6">
          <div
            className="flex flex-col items-center justify-center gap-5 text-center"
            style={{
              width: 360,
              padding: "48px 28px",
              borderRadius: 22,
              background: "linear-gradient(158deg, rgba(28,18,54,0.75) 0%, rgba(14,8,28,0.55) 100%)",
              border: "1.5px dashed rgba(168,85,247,0.4)",
              backdropFilter: "blur(14px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(168,85,247,0.12)",
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: "linear-gradient(135deg, rgba(123,79,212,0.3), rgba(168,85,247,0.2))",
              border: "1px solid rgba(168,85,247,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 22px rgba(168,85,247,0.35)",
            }}>
              <Sparkles size={28} style={{ color: "#e9d5ff" }} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white mb-1">
                Hey {username}
              </h1>
              <p className="text-xs text-[var(--color-text-muted)] mb-1 max-w-[260px]">
                Mint a card to freeze your <span className="text-[#e9d5ff] font-bold">{primaryCar.make}</span> forever. It&apos;ll talk back.
              </p>
            </div>
            <Link
              href="/mint"
              className="mt-2 inline-flex items-center gap-2 h-11 px-6 rounded-xl font-bold text-xs"
              style={{
                background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                color: "#fff",
                boxShadow: "0 6px 24px rgba(168,85,247,0.45)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <Sparkles size={14} />
              Mint first card
            </Link>
          </div>
        </PageContainer>
      </div>
    );
  }

  // ── Has a card: render the hero with client-side interactivity ──
  return (
    <div className="min-h-dvh animate-fade relative overflow-hidden">
      {/* Ambient nebula */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 50% at 50% 10%, rgba(168,85,247,0.22) 0%, transparent 60%)",
            "radial-gradient(ellipse 60% 40% at 20% 80%, rgba(91,33,182,0.18) 0%, transparent 60%)",
            "radial-gradient(ellipse 50% 40% at 85% 60%, rgba(59,130,246,0.12) 0%, transparent 60%)",
          ].join(", "),
        }}
      />

      <HomeHero
        card={latestCard}
        carLabel={primaryCarLabel}
        carMake={primaryCar.make}
        carModel={primaryCar.model}
        carYear={primaryCar.year}
        username={username}
        totalCards={totalCards}
        installedModCount={installedMods.length}
        wishlistCount={wishlistMods.length}
        totalInvested={totalInvested}
        wishlistCost={wishlistCost}
        biggestModName={biggestMod?.name ?? null}
        biggestModCost={biggestMod?.cost ?? null}
        latestModName={latestMod?.name ?? null}
        daysSinceMint={daysSinceMint}
        previousCardFlavourText={previousCardFlavourText}
      />
    </div>
  );
}
