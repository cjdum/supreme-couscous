import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Lock, DollarSign, Wrench, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CategoryBadge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CarDetailTabs } from "@/components/garage/car-detail-tabs";
import { AiSuggestions } from "@/components/garage/ai-suggestions";
import type { Car, Mod, ModCategory } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ carId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { carId } = await params;
  const supabase = await createClient();
  const { data: carRaw } = await supabase
    .from("cars")
    .select("make, model, year")
    .eq("id", carId)
    .maybeSingle();
  const car = carRaw as Pick<Car, "make" | "model" | "year"> | null;
  return { title: car ? `${car.year} ${car.make} ${car.model} — ModVault` : "Car" };
}

export default async function CarDetailPage({ params }: Props) {
  const { carId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: carRaw } = await supabase
    .from("cars")
    .select("*")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();

  const car = carRaw as Car | null;
  if (!car) notFound();

  const { data: modsRaw } = await supabase
    .from("mods")
    .select("*")
    .eq("car_id", carId)
    .order("created_at", { ascending: false });
  const mods = (modsRaw ?? []) as Mod[];

  const installed = mods.filter((m) => m.status === "installed");
  const wishlist = mods.filter((m) => m.status === "wishlist");

  const totalSpent = installed.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  // Top spending category
  const categoryTotals = installed.reduce<Record<ModCategory, number>>(
    (acc, m) => {
      acc[m.category as ModCategory] = (acc[m.category as ModCategory] ?? 0) + (m.cost ?? 0);
      return acc;
    },
    {} as Record<ModCategory, number>
  );
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Hero image ── */}
      <div className="relative">
        {car.cover_image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={car.cover_image_url}
              alt={`${car.year} ${car.make} ${car.model}`}
              className="w-full object-cover"
              style={{ height: "clamp(200px, 40vw, 320px)" }}
            />
            {/* Gradient over photo — strong at top for nav, moderate at bottom for content */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />
          </>
        ) : (
          <div
            className="w-full bg-[var(--color-bg-elevated)]"
            style={{ height: "clamp(160px, 30vw, 220px)" }}
          >
            {/* Abstract brand gradient placeholder */}
            <div
              className="w-full h-full"
              style={{
                background: `radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.18) 0%, transparent 70%),
                             linear-gradient(160deg, rgba(59,130,246,0.1) 0%, #09090b 70%)`,
              }}
            />
          </div>
        )}

        {/* Back button */}
        <div className="absolute top-4 left-4">
          <Link
            href="/garage"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white transition-colors bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full"
          >
            <ArrowLeft size={12} />
            Garage
          </Link>
        </div>

        {/* Public/private */}
        <div className="absolute top-4 right-4">
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-medium"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              color: car.is_public ? "#22c55e" : "#71717a",
            }}
          >
            {car.is_public ? (
              <><Globe size={10} /> Public</>
            ) : (
              <><Lock size={10} /> Private</>
            )}
          </div>
        </div>

        {/* Car title — overlaid on bottom of hero */}
        {car.cover_image_url && (
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
            {car.nickname && (
              <p className="text-xs font-semibold text-[var(--color-accent-bright)] mb-0.5">
                {car.nickname}
              </p>
            )}
            <h1 className="text-2xl font-bold text-white leading-tight drop-shadow">
              {car.year} {car.make} {car.model}
            </h1>
            {car.trim && (
              <p className="text-sm text-white/60 mt-0.5">{car.trim}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Car title (no photo) ── */}
      {!car.cover_image_url && (
        <div className="px-5 pt-5 pb-2">
          {car.nickname && (
            <p className="text-xs font-semibold text-[var(--color-accent-bright)] mb-0.5">
              {car.nickname}
            </p>
          )}
          <h1 className="text-2xl font-bold leading-tight">
            {car.year} {car.make} {car.model}
          </h1>
          {car.trim && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{car.trim}</p>
          )}
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="mx-4 mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
          <div className="flex flex-col items-center py-4 gap-1">
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <Wrench size={12} />
              <span className="text-[10px] font-medium uppercase tracking-wider">Installed</span>
            </div>
            <p className="text-2xl font-bold">{installed.length}</p>
          </div>
          <div className="flex flex-col items-center py-4 gap-1">
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <DollarSign size={12} />
              <span className="text-[10px] font-medium uppercase tracking-wider">Invested</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-accent-bright)]">
              {totalSpent > 0 ? formatCurrency(totalSpent) : "—"}
            </p>
          </div>
          <div className="flex flex-col items-center py-4 gap-1">
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <TrendingUp size={12} />
              <span className="text-[10px] font-medium uppercase tracking-wider">Top spend</span>
            </div>
            {topCategory ? (
              <div className="flex flex-col items-center gap-1">
                <CategoryBadge category={topCategory[0] as ModCategory} className="text-[10px]" />
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {formatCurrency(topCategory[1])}
                </p>
              </div>
            ) : (
              <p className="text-2xl font-bold text-[var(--color-text-muted)]">—</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="px-4 pb-8 mt-5 space-y-5">
        {/* AI Suggestions */}
        <AiSuggestions carId={carId} />

        {/* Mod tabs */}
        <CarDetailTabs installed={installed} wishlist={wishlist} carId={carId} />

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            href={`/visualizer?carId=${carId}`}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-center card-hover"
          >
            <p className="text-xl mb-1.5">✨</p>
            <p className="text-xs font-semibold">AI Visualizer</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Render your build</p>
          </Link>
          <Link
            href="/stats"
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-center card-hover"
          >
            <p className="text-xl mb-1.5">📊</p>
            <p className="text-xs font-semibold">Build Stats</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Spending breakdown</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
