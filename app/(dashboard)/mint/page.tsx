import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, ChevronRight, GalleryHorizontal, Car } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/page-container";
import type { Car as CarType } from "@/lib/supabase/types";
import type { MintedCard } from "@/lib/pixel-card";

export const metadata = { title: "Mint — MODVAULT" };

export default async function MintPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: carsRaw } = await supabase
    .from("cars")
    .select("id, year, make, model, trim, nickname, cover_image_url, is_primary")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  const cars = (carsRaw ?? []) as Pick<
    CarType,
    "id" | "year" | "make" | "model" | "trim" | "nickname" | "cover_image_url" | "is_primary"
  >[];

  if (cars.length === 0) redirect("/garage");

  // Card counts per car
  const { data: cardsRaw } = await supabase
    .from("pixel_cards")
    .select("car_id")
    .eq("user_id", user.id);
  const cardCounts: Record<string, number> = {};
  for (const c of cardsRaw ?? []) {
    const id = (c as Pick<MintedCard, "car_id">).car_id ?? "";
    if (id) cardCounts[id] = (cardCounts[id] ?? 0) + 1;
  }

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="2xl" className="pt-10 pb-20">
        {/* Header */}
        <div className="mb-10 text-center">
          <div
            style={{
              width: 56, height: 56, borderRadius: 16,
              background: "linear-gradient(135deg, rgba(123,79,212,0.25) 0%, rgba(168,85,247,0.15) 100%)",
              border: "1px solid rgba(123,79,212,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Sparkles size={24} style={{ color: "#a855f7" }} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
            Mint a Card
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xs mx-auto">
            Pick a build to freeze as a permanent pixel card. Every mint is a snapshot in time.
          </p>
        </div>

        {/* Car picker */}
        <div className="space-y-3">
          {cars.map((car) => {
            const count = cardCounts[car.id] ?? 0;
            const label = car.nickname ?? `${car.year} ${car.make} ${car.model}`;
            const sublabel = car.nickname ? `${car.year} ${car.make} ${car.model}` : (car.trim ?? null);

            return (
              <Link
                key={car.id}
                href={`/garage/${car.id}?action=mint`}
                style={{ textDecoration: "none" }}
              >
                <div
                  className="group flex items-center gap-4 p-4 rounded-2xl transition-all"
                  style={{
                    background: car.is_primary
                      ? "linear-gradient(135deg, rgba(123,79,212,0.1) 0%, rgba(168,85,247,0.06) 100%)"
                      : "var(--color-bg-card)",
                    border: `1px solid ${car.is_primary ? "rgba(123,79,212,0.35)" : "var(--color-border)"}`,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(123,79,212,0.6)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = car.is_primary
                      ? "rgba(123,79,212,0.35)"
                      : "var(--color-border)";
                    (e.currentTarget as HTMLDivElement).style.transform = "";
                  }}
                >
                  {/* Cover photo or brand icon */}
                  <div
                    style={{
                      width: 56, height: 56, borderRadius: 12,
                      flexShrink: 0, overflow: "hidden",
                      background: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {car.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={car.cover_image_url}
                        alt={label}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Car size={22} style={{ color: "var(--color-text-muted)", opacity: 0.4 }} />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{label}</p>
                      {car.is_primary && (
                        <span
                          style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                            color: "#fbbf24", background: "rgba(251,191,36,0.1)",
                            border: "1px solid rgba(251,191,36,0.25)",
                            padding: "2px 6px", borderRadius: 6, flexShrink: 0,
                            textTransform: "uppercase",
                          }}
                        >
                          Primary
                        </span>
                      )}
                    </div>
                    {sublabel && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{sublabel}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1.5">
                      <GalleryHorizontal size={11} style={{ color: count > 0 ? "#a855f7" : "var(--color-text-muted)" }} />
                      <span
                        style={{
                          fontSize: 10, fontFamily: "ui-monospace, monospace",
                          color: count > 0 ? "rgba(168,85,247,0.7)" : "var(--color-text-muted)",
                          fontWeight: 700, letterSpacing: "0.05em",
                        }}
                      >
                        {count === 0 ? "No cards yet" : `${count} card${count !== 1 ? "s" : ""} minted`}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: "rgba(123,79,212,0.12)", border: "1px solid rgba(123,79,212,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <ChevronRight size={14} style={{ color: "#a855f7" }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer hint */}
        <p
          style={{
            marginTop: 32, textAlign: "center",
            fontFamily: "ui-monospace, monospace", fontSize: 10,
            color: "var(--color-text-muted)", letterSpacing: "0.06em",
          }}
        >
          You&rsquo;ll review and confirm before anything is minted.
        </p>
      </PageContainer>
    </div>
  );
}
