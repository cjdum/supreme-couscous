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
import { SpendingChart } from "@/components/mods/spending-chart";
import { CarPhotoManager } from "@/components/garage/car-photo-manager";
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
  return { title: car ? `${car.year} ${car.make} ${car.model} — MODVAULT` : "Car" };
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
  const totalInvested = installed.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  // Category totals for chart
  const categoryTotals = installed.reduce<Record<string, number>>(
    (acc, m) => {
      acc[m.category] = (acc[m.category] ?? 0) + (m.cost ?? 0);
      return acc;
    },
    {}
  );
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  // Summary cards data
  const mostExpensive = [...installed].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0] ?? null;
  const newest = [...installed].sort((a, b) =>
    new Date(b.install_date ?? b.created_at).getTime() - new Date(a.install_date ?? a.created_at).getTime()
  )[0] ?? null;
  const nextPlanned = wishlist[0] ?? null;

  // Spending chart data
  const chartData = MOD_CATEGORIES
    .map((cat) => ({
      name: cat.label,
      value: categoryTotals[cat.value] ?? 0,
      color: cat.color,
    }))
    .filter((d) => d.value > 0);

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
              style={{ height: "clamp(220px, 45vw, 360px)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85" />
          </>
        ) : (
          <div
            className="w-full"
            style={{ height: "clamp(180px, 35vw, 260px)" }}
          >
            <div
              className="w-full h-full"
              style={{
                background: `radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.18) 0%, transparent 65%),
                             linear-gradient(160deg, rgba(59,130,246,0.08) 0%, #000 65%)`,
              }}
            />
          </div>
        )}

        {/* Back */}
        <div className="absolute top-4 left-4">
          <Link
            href="/garage"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/75 hover:text-white transition-colors bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"
          >
            <ArrowLeft size={11} />
            Garage
          </Link>
        </div>

        {/* Public badge */}
        <div className="absolute top-4 right-4">
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold backdrop-blur-md border border-white/10"
            style={{
              backgroundColor: "rgba(0,0,0,0.6)",
              color: car.is_public ? "#22c55e" : "rgba(255,255,255,0.35)",
            }}
          >
            {car.is_public ? <><Globe size={10} /> Public</> : <><Lock size={10} /> Private</>}
          </div>
        </div>

        {/* Car title over hero */}
        {car.cover_image_url && (
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
            {car.nickname && (
              <p className="text-xs font-bold text-[#60A5FA] mb-0.5 tracking-widest uppercase">
                {car.nickname}
              </p>
            )}
            <h1 className="text-[26px] font-bold text-white leading-tight drop-shadow">
              {car.year} {car.make} {car.model}
            </h1>
            {car.trim && <p className="text-sm text-white/40 mt-0.5">{car.trim}</p>}
          </div>
        )}
      </div>

      {/* Car title without photo */}
      {!car.cover_image_url && (
        <div className="px-5 pt-5 pb-2">
          {car.nickname && (
            <p className="text-xs font-bold text-[#60A5FA] mb-0.5 tracking-widest uppercase">
              {car.nickname}
            </p>
          )}
          <h1 className="text-2xl font-bold leading-tight">
            {car.year} {car.make} {car.model}
          </h1>
          {car.trim && <p className="text-sm text-[rgba(255,255,255,0.35)] mt-0.5">{car.trim}</p>}
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="mx-4 mt-4 rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.05)]">
          <div className="flex flex-col items-center py-4 gap-1">
            <div className="flex items-center gap-1 text-[rgba(255,255,255,0.28)]">
              <Wrench size={10} />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Installed</span>
            </div>
            <p className="text-2xl font-bold">{installed.length}</p>
          </div>
          <div className="flex flex-col items-center py-4 gap-1">
            <div className="flex items-center gap-1 text-[rgba(255,255,255,0.28)]">
              <DollarSign size={10} />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Invested</span>
            </div>
            <p className="text-2xl font-bold text-[#60A5FA]">
              {totalInvested > 0 ? formatCurrency(totalInvested) : "—"}
            </p>
          </div>
          <div className="flex flex-col items-center py-4 gap-1">
            <div className="flex items-center gap-1 text-[rgba(255,255,255,0.28)]">
              <TrendingUp size={10} />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Top spend</span>
            </div>
            {topCategory ? (
              <div className="flex flex-col items-center gap-1 mt-0.5">
                <CategoryBadge category={topCategory[0] as ModCategory} className="text-[9px]" />
                <p className="text-[9px] text-[rgba(255,255,255,0.35)]">{formatCurrency(topCategory[1])}</p>
              </div>
            ) : (
              <p className="text-2xl font-bold text-[rgba(255,255,255,0.15)]">—</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      {(mostExpensive || newest || nextPlanned) && (
        <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
          {/* Most expensive */}
          <div className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-3">
            <div className="flex items-center gap-1 mb-2">
              <Star size={10} className="text-[#fbbf24]" />
              <p className="text-[9px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider">Biggest</p>
            </div>
            {mostExpensive ? (
              <>
                <p className="text-xs font-bold leading-snug line-clamp-2 mb-1">{mostExpensive.name}</p>
                <p className="text-[10px] font-semibold text-[#fbbf24]">
                  {mostExpensive.cost ? formatCurrency(mostExpensive.cost) : "—"}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-[rgba(255,255,255,0.2)]">—</p>
            )}
          </div>

          {/* Newest mod */}
          <div className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-3">
            <div className="flex items-center gap-1 mb-2">
              <Calendar size={10} className="text-[#22c55e]" />
              <p className="text-[9px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider">Latest</p>
            </div>
            {newest ? (
              <>
                <p className="text-xs font-bold leading-snug line-clamp-2 mb-1">{newest.name}</p>
                <p className="text-[10px] text-[rgba(255,255,255,0.35)]">
                  {newest.install_date ? formatDate(newest.install_date) : "Recently"}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-[rgba(255,255,255,0.2)]">—</p>
            )}
          </div>

          {/* Next planned */}
          <div className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-3">
            <div className="flex items-center gap-1 mb-2">
              <BookmarkCheck size={10} className="text-[#3B82F6]" />
              <p className="text-[9px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider">Next</p>
            </div>
            {nextPlanned ? (
              <>
                <p className="text-xs font-bold leading-snug line-clamp-2 mb-1">{nextPlanned.name}</p>
                <p className="text-[10px] font-semibold text-[#60A5FA]">
                  {nextPlanned.cost ? formatCurrency(nextPlanned.cost) : "Planned"}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-[rgba(255,255,255,0.2)]">Nothing yet</p>
            )}
          </div>
        </div>
      )}

      {/* ── Spending chart ── */}
      {chartData.length > 0 && (
        <div className="mx-4 mt-4 rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-4">
          <p className="text-xs font-semibold text-[rgba(255,255,255,0.35)] uppercase tracking-wider mb-3">Investment by Category</p>
          <SpendingChart data={chartData} total={totalInvested} />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="px-4 pb-8 mt-5 space-y-6">
        <CarPhotoManager carId={carId} currentPhotoUrl={car.cover_image_url} />
        <VehicleSpecs car={car} />
        <AiSuggestions carId={carId} />
        <CarDetailTabs installed={installed} wishlist={wishlist} carId={carId} />

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/visualizer?carId=${carId}`}
            className="rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-4 text-center card-hover"
          >
            <Zap size={18} className="mx-auto mb-1.5 text-[#3B82F6]" />
            <p className="text-xs font-semibold">AI Visualizer</p>
            <p className="text-[10px] text-[rgba(255,255,255,0.28)] mt-0.5">Render your build</p>
          </Link>
          <Link
            href={`/chat?carId=${carId}`}
            className="rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-4 text-center card-hover"
          >
            <MessageSquare size={18} className="mx-auto mb-1.5 text-[#3B82F6]" />
            <p className="text-xs font-semibold">Ask AI</p>
            <p className="text-[10px] text-[rgba(255,255,255,0.28)] mt-0.5">Chat about your car</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
