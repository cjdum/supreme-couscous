import Link from "next/link";
import { redirect } from "next/navigation";
import { GalleryHorizontal, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CardCollection } from "@/components/garage/card-collection";
import { PageContainer } from "@/components/ui/page-container";
import type { MintedCard } from "@/lib/pixel-card";
import type { Car } from "@/lib/supabase/types";

export const metadata = { title: "Cards — MODVAULT" };

export default async function CardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // All minted cards for this user, newest first
  const { data: cardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("minted_at", { ascending: false });
  const cards = (cardsRaw ?? []) as MintedCard[];

  // Cars for section headers + primary car resolution
  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, year, make, model, is_primary")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  const cars = (carsRaw ?? []) as Pick<Car, "id" | "year" | "make" | "model" | "is_primary">[];

  const carLabels: Record<string, string> = {};
  for (const c of cars) {
    carLabels[c.id] = `${c.year} ${c.make} ${c.model}`;
  }
  const primaryCar = cars.find((c) => c.is_primary) ?? cars[0] ?? null;

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="7xl" className="pt-10 pb-16">
        {/* Single clean page heading (no duplicate section title below) */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[rgba(123,79,212,0.15)] border border-[rgba(123,79,212,0.3)] dark:bg-[rgba(123,79,212,0.15)]">
              <GalleryHorizontal size={18} style={{ color: "#7b4fd4" }} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">Cards</h1>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {cards.length > 0
                  ? `${cards.length} permanent ${cards.length === 1 ? "snapshot" : "snapshots"} across your fleet`
                  : "Your first card is one mint away"}
              </p>
            </div>
          </div>

          {/* Prominent Mint button at the top of the Cards tab */}
          {primaryCar && (
            <Link
              href={`/garage/${primaryCar.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 12,
                background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                border: "1px solid rgba(123,79,212,0.6)",
                color: "white", fontFamily: "ui-monospace, monospace",
                fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", textDecoration: "none",
                boxShadow: "0 4px 20px rgba(123,79,212,0.4)",
                whiteSpace: "nowrap",
              }}
            >
              <Sparkles size={13} />
              Mint a Card
            </Link>
          )}
        </div>

        {cards.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "80px 24px", gap: 16, textAlign: "center",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: "rgba(123,79,212,0.1)", border: "2px solid rgba(123,79,212,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <GalleryHorizontal size={28} style={{ color: "rgba(123,79,212,0.5)" }} />
            </div>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: "rgba(200,180,240,0.5)", letterSpacing: "0.06em" }}>
              No cards minted yet
            </p>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(160,140,200,0.35)", letterSpacing: "0.04em", maxWidth: 280 }}>
              Open a car in your garage and tap &ldquo;Mint card&rdquo; to create your first permanent snapshot.
            </p>
          </div>
        ) : (
          /* hideSectionHeader=true so there is no duplicate "Collection" heading below the page title */
          <CardCollection cards={cards} carLabels={carLabels} hideSectionHeader />
        )}
      </PageContainer>
    </div>
  );
}
