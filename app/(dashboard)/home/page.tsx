import Link from "next/link";
import { Sparkles, Car, GalleryHorizontal, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { HeroCardViewer } from "@/components/garage/hero-card-viewer";
import { PageContainer } from "@/components/ui/page-container";
import type { Car as CarType } from "@/lib/supabase/types";
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
  const primaryCarLabel = primaryCar
    ? `${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`
    : null;

  // Latest living card for the primary car
  let latestCard: MintedCard | null = null;
  let totalCards = 0;
  if (primaryCar) {
    const { data: cardsRaw } = await supabase
      .from("pixel_cards")
      .select("*")
      .eq("user_id", user!.id)
      .eq("car_id", primaryCar.id)
      .order("minted_at", { ascending: false });
    const primaryCards = (cardsRaw ?? []) as MintedCard[];
    totalCards = primaryCards.length;
    latestCard = primaryCards[0] ?? null;
  }

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

      <PageContainer maxWidth="5xl" className="relative z-10 pt-10 pb-24">
        {/* Tiny welcome line */}
        <p
          className="text-center mb-8 text-[10px] font-bold uppercase"
          style={{
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.22em",
            color: "rgba(200,180,240,0.5)",
          }}
        >
          {username}&apos;s vault · {primaryCarLabel}
        </p>

        {/* ── The card (hero) ── */}
        <section className="flex flex-col items-center gap-6 mb-14">
          {latestCard ? (
            <>
              <HeroCardViewer card={latestCard} carLabel={primaryCarLabel!} scale={1.1} />

              {/* Card info panel — always visible, no click needed */}
              <div
                className="w-full max-w-sm text-center"
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                {latestCard.flavor_text && (
                  <p
                    style={{
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "rgba(220,205,255,0.8)",
                      fontStyle: "italic",
                      margin: 0,
                    }}
                  >
                    &ldquo;{latestCard.flavor_text}&rdquo;
                  </p>
                )}
                {latestCard.occasion && (
                  <p
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 10,
                      color: "rgba(168,85,247,0.6)",
                      letterSpacing: "0.08em",
                      margin: 0,
                    }}
                  >
                    {latestCard.occasion}
                  </p>
                )}
                <p
                  className="text-[10px] font-bold uppercase"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.18em",
                    color: "rgba(200,180,240,0.4)",
                    margin: 0,
                  }}
                >
                  {totalCards} {totalCards === 1 ? "card" : "cards"} minted
                </p>
                <Link
                  href="/card-chat"
                  className="inline-block text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    color: "rgba(168,85,247,0.85)",
                    letterSpacing: "0.14em",
                  }}
                >
                  Talk to your card →
                </Link>
              </div>
            </>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-4 text-center"
              style={{
                width: 300,
                height: 420,
                borderRadius: 18,
                background: "linear-gradient(158deg, rgba(123,79,212,0.10) 0%, rgba(168,85,247,0.05) 100%)",
                border: "1.5px dashed rgba(168,85,247,0.35)",
              }}
            >
              <Sparkles size={28} style={{ color: "rgba(168,85,247,0.55)" }} />
              <p
                className="text-xs font-bold uppercase"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.16em",
                  color: "rgba(200,180,240,0.65)",
                }}
              >
                No card yet
              </p>
              <p className="text-xs text-[var(--color-text-muted)] max-w-[220px] px-4">
                Mint a card to freeze your {primaryCar.make} forever.
              </p>
              <Link
                href="/mint"
                className="mt-2 inline-flex items-center gap-2 h-10 px-5 rounded-xl font-bold text-xs"
                style={{
                  background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                  color: "#fff",
                  boxShadow: "0 4px 16px rgba(168,85,247,0.4)",
                }}
              >
                <Sparkles size={13} />
                Mint first card
              </Link>
            </div>
          )}
        </section>

        {/* ── Quick actions: 4 cards, card-first order ── */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {[
              {
                href: "/mint",
                icon: Sparkles,
                label: "Mint",
                hint: "New card",
                tint: "rgba(168,85,247,0.85)",
              },
              {
                href: "/cards",
                icon: GalleryHorizontal,
                label: "Collection",
                hint: `${totalCards} ${totalCards === 1 ? "card" : "cards"}`,
                tint: "#fbbf24",
              },
              {
                href: "/card-chat",
                icon: MessageSquare,
                label: "Talk",
                hint: "To your card",
                tint: "#c4b5fd",
              },
              {
                href: "/garage",
                icon: Car,
                label: "Garage",
                hint: `${cars.length} ${cars.length === 1 ? "car" : "cars"}`,
                tint: "rgba(200,180,240,0.85)",
              },
            ].map(({ href, icon: Icon, label, hint, tint }) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl p-4 flex flex-col items-start gap-2 card-hover group"
                style={{
                  background: "rgba(15,12,30,0.55)",
                  border: "1px solid rgba(168,85,247,0.18)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Icon size={18} style={{ color: tint }} />
                <div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{label}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{hint}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </PageContainer>
    </div>
  );
}
