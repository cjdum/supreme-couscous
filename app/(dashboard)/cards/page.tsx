import { redirect } from "next/navigation";
import { GalleryHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CardCollection } from "@/components/garage/card-collection";
import { PageContainer } from "@/components/ui/page-container";
import type { MintedCard } from "@/lib/pixel-card";

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

  // Car labels for section headers
  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, year, make, model")
    .eq("user_id", user.id);
  const carLabels: Record<string, string> = {};
  for (const c of (carsRaw ?? []) as { id: string; year: number; make: string; model: string }[]) {
    carLabels[c.id] = `${c.year} ${c.make} ${c.model}`;
  }

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="5xl" className="pt-10 pb-16">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-[rgba(123,79,212,0.15)] border border-[rgba(123,79,212,0.3)]">
            <GalleryHorizontal size={18} style={{ color: "#7b4fd4" }} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Cards</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {cards.length > 0
                ? `${cards.length} permanent ${cards.length === 1 ? "snapshot" : "snapshots"} across your fleet`
                : "Mint your first card from a car detail page"}
            </p>
          </div>
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
          <CardCollection cards={cards} carLabels={carLabels} />
        )}
      </PageContainer>
    </div>
  );
}
