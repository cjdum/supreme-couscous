import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Globe, Lock, DollarSign, Wrench, Zap, MessageSquare,
  TrendingUp, Calendar, Star, BookmarkCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CategoryBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate, MOD_CATEGORIES } from "@/lib/utils";
import { CarDetailTabs } from "@/components/garage/car-detail-tabs";
import { AiSuggestions } from "@/components/garage/ai-suggestions";
import { VehicleSpecs } from "@/components/garage/vehicle-specs";
import { PixelCard } from "@/components/garage/pixel-card";
import { calculateBuildScore } from "@/lib/build-score";
import { SpendingChart } from "@/components/mods/spending-chart";
import { CarGallery } from "@/components/garage/car-gallery";
import { BuildTimeline } from "@/components/garage/build-timeline";
import { EditCarButton } from "@/components/garage/edit-car-button";
import type { Car, Mod, ModCategory, Render } from "@/lib/supabase/types";
import type { MintedCard } from "@/lib/pixel-card";

interface Props {
  params: Promise<{ carId: string }>;
  searchParams: Promise<{ action?: string }>;
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
  return { title: car ? `${car.year} ${car.make} ${car.model} — MODVAULT` : "Car" };
}

export default async function CarDetailPage({ params, searchParams }: Props) {
  const { carId } = await params;
  const { action } = await searchParams;
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

  // Renders for the new "Renders" tab + set-as-banner workflow
  const { data: rendersRaw } = await supabase
    .from("renders")
    .select("*")
    .eq("car_id", carId)
    .not("image_url", "is", null)
    .order("is_banner", { ascending: false })
    .order("created_at", { ascending: false });
  const renders = (rendersRaw ?? []) as Render[];

  const { count: photoCount } = await supabase
    .from("car_photos")
    .select("id", { count: "exact", head: true })
    .eq("car_id", carId);
  void photoCount;

  // All pixel cards for this car (timeline + latest)
  const { data: allCardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("car_id", carId)
    .eq("user_id", user.id)
    .order("minted_at", { ascending: true }); // oldest first for timeline
  const allCarCards = (allCardsRaw ?? []) as MintedCard[];
  const cardCount = allCarCards.length;
  const latestCard = allCarCards.length > 0 ? allCarCards[allCarCards.length - 1] : null;

  const installed = mods.filter((m) => m.status === "installed");
  const wishlist = mods.filter((m) => m.status === "wishlist");

  const buildScoreResult = calculateBuildScore({
    cars: [
      {
        cover_image_url: car.cover_image_url,
        horsepower: car.horsepower,
        engine_size: car.engine_size,
        specs_ai_guessed: car.specs_ai_guessed,
        is_primary: true,
      },
    ],
    mods,
  });
  const totalInvested = installed.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  const categoryTotals = installed.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] ?? 0) + (m.cost ?? 0);
    return acc;
  }, {});
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  const mostExpensive = [...installed].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0] ?? null;
  const newest =
    [...installed].sort(
      (a, b) => new Date(b.install_date ?? b.created_at).getTime() - new Date(a.install_date ?? a.created_at).getTime()
    )[0] ?? null;
  const nextPlanned = wishlist[0] ?? null;

  const chartData = MOD_CATEGORIES.map((cat) => ({
    name: cat.label,
    value: categoryTotals[cat.value] ?? 0,
    color: cat.color,
  })).filter((d) => d.value > 0);

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ height: "clamp(280px, 45vw, 460px)" }}>
        {car.cover_image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={car.cover_image_url}
              alt={`${car.year} ${car.make} ${car.model}`}
              className="absolute inset-0 w-full h-full object-cover animate-cinematic"
              style={{ objectPosition: "center center" }}
            />
            {/* Vignette to make the car pop */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 45%, transparent 0%, transparent 40%, rgba(0,0,0,0.45) 90%, rgba(0,0,0,0.7) 100%)",
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.15) 0%, transparent 65%),
                             linear-gradient(160deg, rgba(59,130,246,0.06) 0%, #000 65%)`,
            }}
          />
        )}
        {/* Top fade for back button */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        {/* Bottom gradient behind text */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />

        {/* Back */}
        <div className="absolute top-4 left-4 lg:top-6 lg:left-6">
          <Link
            href="/garage"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white/75 hover:text-white transition-colors bg-black/50 backdrop-blur-xl px-3.5 py-2 rounded-xl border border-white/[0.10]"
          >
            <ArrowLeft size={12} />
            Garage
          </Link>
        </div>

        {/* Top right: Edit + Public badge */}
        <div className="absolute top-4 right-4 lg:top-6 lg:right-6 flex items-center gap-2">
          {car.is_primary && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: "rgba(251,191,36,0.12)",
                border: "1px solid rgba(251,191,36,0.30)",
                color: "#fbbf24",
                backdropFilter: "blur(12px)",
              }}
            >
              <Star size={9} fill="currentColor" /> Primary
            </div>
          )}
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold backdrop-blur-xl border border-white/[0.10]"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              color: car.is_public ? "#30d158" : "#888",
            }}
          >
            {car.is_public ? <><Globe size={10} /> Public</> : <><Lock size={10} /> Private</>}
          </div>
          <EditCarButton car={car} cardCount={cardCount ?? 0} />
        </div>

        {/* Car title over hero */}
        {car.cover_image_url && (
          <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-7">
            <div className="max-w-6xl mx-auto">
              {car.nickname && (
                <p className="text-[11px] font-bold text-[#60A5FA] mb-1 tracking-[0.2em] uppercase">{car.nickname}</p>
              )}
              <h1
                className="text-xl sm:text-2xl font-bold text-white leading-tight tracking-tight"
                style={{ textShadow: "0 2px 16px rgba(0,0,0,0.8)" }}
              >
                {car.year} {car.make} {car.model}
              </h1>
              {car.trim && (
                <p className="text-sm text-white/55 mt-0.5 font-medium" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>
                  {car.trim}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Car title without photo */}
      {!car.cover_image_url && (
        <div className="px-5 sm:px-8 pt-6 pb-2">
          {car.nickname && (
            <p className="text-xs font-bold text-[#60A5FA] mb-1 tracking-[0.15em] uppercase">{car.nickname}</p>
          )}
          <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight">
            {car.year} {car.make} {car.model}
          </h1>
          {car.trim && <p className="text-sm text-[var(--color-text-muted)] mt-1">{car.trim}</p>}
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="mx-5 sm:mx-8 mt-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
          <div className="flex flex-col items-center py-5 lg:py-6 gap-1.5">
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <Wrench size={11} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Installed</span>
            </div>
            <p className="text-2xl lg:text-3xl font-black tabular">{installed.length}</p>
          </div>
          <div className="flex flex-col items-center py-5 lg:py-6 gap-1.5">
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <DollarSign size={11} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Invested</span>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-[#60A5FA] tabular">
              {totalInvested > 0 ? formatCurrency(totalInvested) : "—"}
            </p>
          </div>
          <div className="flex flex-col items-center py-5 lg:py-6 gap-1.5">
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <TrendingUp size={11} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Top spend</span>
            </div>
            {topCategory ? (
              <div className="flex flex-col items-center gap-1 mt-0.5">
                <CategoryBadge category={topCategory[0] as ModCategory} className="text-[9px]" />
                <p className="text-[9px] text-[var(--color-text-muted)] font-bold tabular">{formatCurrency(topCategory[1])}</p>
              </div>
            ) : (
              <p className="text-2xl font-bold text-[var(--color-text-disabled)]">—</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      {(mostExpensive || newest || nextPlanned) && (
        <div className="mx-5 sm:mx-8 mt-4 grid grid-cols-3 gap-2.5 lg:gap-3 stagger-children">
          <SummaryCard
            icon={<Star size={11} className="text-[#fbbf24]" />}
            label="Biggest"
            mod={mostExpensive}
            valueColor="#fbbf24"
            valueText={mostExpensive?.cost ? formatCurrency(mostExpensive.cost) : "—"}
          />
          <SummaryCard
            icon={<Calendar size={11} className="text-[#30d158]" />}
            label="Latest"
            mod={newest}
            valueColor="var(--color-text-muted)"
            valueText={newest?.install_date ? formatDate(newest.install_date) : "Recently"}
          />
          <SummaryCard
            icon={<BookmarkCheck size={11} className="text-[var(--color-accent)]" />}
            label="Next"
            mod={nextPlanned}
            valueColor="#60A5FA"
            valueText={nextPlanned?.cost ? formatCurrency(nextPlanned.cost) : nextPlanned ? "Planned" : "Nothing yet"}
          />
        </div>
      )}

      {/* ── Build Timeline (desktop and mobile horizontal scroll) ── */}
      {installed.length > 0 && (
        <div className="mx-5 sm:mx-8 mt-6">
          <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold tracking-tight">Build Timeline</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Every mod, in order. Tap to expand.</p>
              </div>
            </div>
            <BuildTimeline mods={installed} />
          </div>
        </div>
      )}

      {/* Card timeline lives on /cards (Cards tab), not here. */}

      {/* ── Spending chart ── */}
      {chartData.length > 0 && (
        <div className="mx-5 sm:mx-8 mt-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 lg:p-6">
          <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Investment by Category</p>
          <SpendingChart data={chartData} total={totalInvested} />
        </div>
      )}

      {/* ── Main content (two-column on desktop) ── */}
      <div className="px-5 sm:px-8 pb-12 mt-6 lg:grid lg:grid-cols-3 lg:gap-6 space-y-6 lg:space-y-0">
        <div className="lg:col-span-2 space-y-6">
          <CarGallery carId={carId} initialCoverUrl={car.cover_image_url} />
          <CarDetailTabs installed={installed} wishlist={wishlist} renders={renders} carId={carId} />
        </div>

        <div className="space-y-6">
          <PixelCard
            carId={carId}
            carLabel={`${car.year} ${car.make} ${car.model}`}
            latestCard={latestCard}
            cardCount={cardCount}
            trim={car.trim}
            color={car.color}
            autoMint={action === "mint"}
          />
          <VehicleSpecs car={car} />

          <div className="rounded-2xl border border-[rgba(59,130,246,0.2)] bg-[var(--color-bg-card)] overflow-hidden glow-pulse">
            <AiSuggestions carId={carId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/visualizer?carId=${carId}`}
              className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 text-center card-hover group"
            >
              <Zap size={20} className="mx-auto mb-2 text-[var(--color-accent)] group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold">AI Render</p>
            </Link>
            <Link
              href={`/chat?carId=${carId}`}
              className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 text-center card-hover group"
            >
              <MessageSquare size={20} className="mx-auto mb-2 text-[var(--color-accent)] group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold">Ask AI</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  mod,
  valueText,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  mod: { name: string } | null;
  valueText: string;
  valueColor: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3.5 lg:p-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        {icon}
        <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
      </div>
      {mod ? (
        <>
          <p className="text-xs font-bold leading-snug line-clamp-2 mb-1">{mod.name}</p>
          <p className="text-[10px] font-bold tabular" style={{ color: valueColor }}>
            {valueText}
          </p>
        </>
      ) : (
        <p className="text-[10px] text-[var(--color-text-disabled)]">—</p>
      )}
    </div>
  );
}
