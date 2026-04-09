import Link from "next/link";
import { Sparkles, Car, GalleryHorizontal, MessageSquare, Wrench, DollarSign, Gauge, Zap } from "lucide-react";
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

        {/* ── The card (hero) + detail panel ── */}
        <section className="mb-14">
          {latestCard ? (
            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 lg:gap-12">
              {/* Card on the left */}
              <div className="flex-shrink-0">
                <HeroCardViewer card={latestCard} carLabel={primaryCarLabel!} scale={1.1} />
              </div>

              {/* Detail panel on the right */}
              <CardDetailPanel
                card={latestCard}
                carLabel={primaryCarLabel!}
                totalCards={totalCards}
              />
            </div>
          ) : (
            <div className="flex justify-center">
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
                label: "Ghosts",
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

// ── CardDetailPanel ──────────────────────────────────────────────────────────
// The big detail panel shown to the right of the card on /home.
// Displays the card's title, personality, stats, flavor text, and a CTA to chat.

type DetailCard = MintedCard & {
  card_title?: string | null;
  personality?: string | null;
  build_archetype?: string | null;
  card_level?: number | null;
};

function CardDetailPanel({
  card,
  carLabel,
  totalCards,
}: {
  card: MintedCard;
  carLabel: string;
  totalCards: number;
}) {
  const detail = card as DetailCard;
  const title = detail.card_title ?? detail.nickname;
  const snap = detail.car_snapshot;
  const mintDate = (() => {
    try {
      return new Date(detail.minted_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  })();

  return (
    <div
      className="w-full lg:max-w-md flex flex-col gap-5"
      style={{
        background: "linear-gradient(160deg, rgba(15,12,30,0.85) 0%, rgba(20,14,38,0.6) 100%)",
        border: "1px solid rgba(168,85,247,0.22)",
        borderRadius: 20,
        padding: "26px 24px",
        backdropFilter: "blur(14px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 30px rgba(123,79,212,0.08)",
      }}
    >
      {/* Title + tagline */}
      <div>
        <p
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(168,85,247,0.55)",
            margin: 0,
            marginBottom: 6,
          }}
        >
          Your living card
        </p>
        <h2
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1.1,
            color: "#f3eaff",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 12,
            color: "rgba(200,180,240,0.55)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.04em",
          }}
        >
          {carLabel}
        </p>
      </div>

      {/* Badge row: personality + era + rarity + level */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {detail.personality && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(168,85,247,0.18)",
              border: "1px solid rgba(168,85,247,0.42)",
              color: "#e9d5ff",
              letterSpacing: "0.08em",
              fontFamily: "ui-monospace, monospace",
              textTransform: "uppercase" as const,
            }}
          >
            {detail.personality}
          </span>
        )}
        {detail.build_archetype && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(96,165,250,0.13)",
              border: "1px solid rgba(96,165,250,0.35)",
              color: "#93c5fd",
              letterSpacing: "0.08em",
              fontFamily: "ui-monospace, monospace",
              textTransform: "uppercase" as const,
            }}
          >
            {detail.build_archetype}
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(245,215,110,0.10)",
            border: "1px solid rgba(245,215,110,0.32)",
            color: "#f5d76e",
            letterSpacing: "0.08em",
            fontFamily: "ui-monospace, monospace",
            textTransform: "uppercase" as const,
          }}
        >
          {detail.era ?? "Chrome"}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(48,209,88,0.10)",
            border: "1px solid rgba(48,209,88,0.32)",
            color: "#30d158",
            letterSpacing: "0.08em",
            fontFamily: "ui-monospace, monospace",
            textTransform: "uppercase" as const,
          }}
        >
          {detail.rarity ?? "Common"}
        </span>
      </div>

      {/* Quick stat grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
        }}
      >
        <StatTile
          icon={<Zap size={12} />}
          label="HP"
          value={detail.hp != null ? String(detail.hp) : "—"}
        />
        <StatTile
          icon={<Wrench size={12} />}
          label="Mods"
          value={detail.mod_count != null ? String(detail.mod_count) : "—"}
        />
        <StatTile
          icon={<DollarSign size={12} />}
          label="Invested"
          value={
            snap?.total_invested != null
              ? `$${snap.total_invested.toLocaleString()}`
              : "—"
          }
        />
        <StatTile
          icon={<Gauge size={12} />}
          label="Build Score"
          value={snap?.build_score != null ? String(snap.build_score) : "—"}
        />
      </div>

      {/* Flavor text */}
      {detail.flavor_text && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(123,79,212,0.08)",
            border: "1px solid rgba(123,79,212,0.18)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontStyle: "italic",
              lineHeight: 1.6,
              color: "rgba(220,205,255,0.85)",
            }}
          >
            &ldquo;{detail.flavor_text}&rdquo;
          </p>
        </div>
      )}

      {/* Occasion */}
      {detail.occasion && (
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(200,180,240,0.45)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: 4,
            }}
          >
            First Memory
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "rgba(220,200,255,0.75)",
              lineHeight: 1.5,
            }}
          >
            {detail.occasion}
          </p>
        </div>
      )}

      {/* Footer: mint date + counter */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 14,
          borderTop: "1px solid rgba(168,85,247,0.12)",
          fontFamily: "ui-monospace, monospace",
          fontSize: 9,
          color: "rgba(200,180,240,0.5)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {mintDate && <span>Born {mintDate}</span>}
        <span>
          {totalCards} {totalCards === 1 ? "card" : "cards"} minted
        </span>
      </div>

      {/* Talk to your card CTA */}
      <Link
        href="/card-chat"
        className="flex items-center justify-center gap-2 rounded-xl"
        style={{
          height: 52,
          background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
          color: "white",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          boxShadow: "0 8px 28px rgba(168,85,247,0.35)",
        }}
      >
        <MessageSquare size={14} />
        Talk to your card
      </Link>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(168,85,247,0.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          color: "rgba(200,180,240,0.5)",
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {label}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 900,
          color: "rgba(240,232,255,0.95)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </p>
    </div>
  );
}
