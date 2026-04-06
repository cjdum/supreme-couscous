import Link from "next/link";
import { ChevronRight, Wrench, Zap, TrendingUp, Award } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CarCard } from "@/components/garage/car-card";
import { OnboardingFlow } from "@/components/garage/onboarding-flow";
import { AddCarButton } from "@/components/garage/add-car-button";
import { formatCurrency } from "@/lib/utils";
import { calculateBuildScore, LEVEL_COLORS } from "@/lib/build-score";
import type { Car as CarType } from "@/lib/supabase/types";

export const metadata = { title: "Garage — MODVAULT" };

export default async function GaragePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: carsRaw } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  const cars = (carsRaw ?? []) as CarType[];

  if (cars.length === 0) {
    return <OnboardingFlow />;
  }

  const carIds = cars.map((c) => c.id);
  type ModStat = { car_id: string; cost: number | null; status: string; install_date: string | null; notes: string | null };
  let modStats: ModStat[] = [];
  if (carIds.length) {
    const { data } = await supabase
      .from("mods")
      .select("car_id, cost, status, install_date, notes")
      .in("car_id", carIds);
    modStats = (data ?? []) as ModStat[];
  }

  const statsMap = new Map<string, { count: number; total: number }>();
  for (const mod of modStats) {
    const existing = statsMap.get(mod.car_id) ?? { count: 0, total: 0 };
    statsMap.set(mod.car_id, {
      count: existing.count + (mod.status === "installed" ? 1 : 0),
      total: existing.total + (mod.status === "installed" ? (mod.cost ?? 0) : 0),
    });
  }

  const primaryCar = cars[0];
  const primaryStats = statsMap.get(primaryCar.id) ?? { count: 0, total: 0 };

  const totalMods = Array.from(statsMap.values()).reduce((s, v) => s + v.count, 0);
  const totalInvested = Array.from(statsMap.values()).reduce((s, v) => s + v.total, 0);

  // Build Score
  const buildScore = calculateBuildScore({
    cars: cars as Parameters<typeof calculateBuildScore>[0]["cars"],
    mods: modStats,
  });
  const levelColor = LEVEL_COLORS[buildScore.level];

  return (
    <div className="min-h-dvh">
      {/* ── Hero: Primary Car ── */}
      <div className="relative w-full" style={{ height: "clamp(280px, 55vw, 420px)" }}>
        {primaryCar.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryCar.cover_image_url}
            alt={`${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.18) 0%, transparent 60%),
                           radial-gradient(ellipse at 80% 20%, rgba(34,197,94,0.06) 0%, transparent 50%),
                           linear-gradient(160deg, rgba(59,130,246,0.08) 0%, #000 60%)`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 200 90" width="180" height="80" fill="none" aria-hidden="true" style={{ opacity: 0.04 }}>
                <path d="M18 72l16-42h132l16 42H18z" stroke="white" strokeWidth="3" strokeLinejoin="round" />
                <path d="M34 44l12-22h108l12 22H34z" stroke="white" strokeWidth="2" strokeLinejoin="round" fill="white" fillOpacity="0.03" />
                <ellipse cx="50" cy="74" rx="10" ry="10" stroke="white" strokeWidth="3" />
                <ellipse cx="150" cy="74" rx="10" ry="10" stroke="white" strokeWidth="3" />
              </svg>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent" />

        {/* Car info overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          {primaryCar.nickname && (
            <p className="text-xs font-bold text-[#60A5FA] mb-1 tracking-widest uppercase">
              {primaryCar.nickname}
            </p>
          )}
          <h1 className="text-3xl font-bold text-white leading-tight mb-0.5">
            {primaryCar.year} {primaryCar.make} {primaryCar.model}
          </h1>
          {primaryCar.trim && (
            <p className="text-sm text-white/40 mb-3">{primaryCar.trim}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {primaryCar.horsepower && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                <Zap size={10} className="text-[#fbbf24]" />
                <span className="text-xs font-bold text-white">{primaryCar.horsepower} hp</span>
              </div>
            )}
            {primaryCar.torque && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                <TrendingUp size={10} className="text-[#22c55e]" />
                <span className="text-xs font-bold text-white">{primaryCar.torque} lb-ft</span>
              </div>
            )}
            {primaryStats.count > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                <Wrench size={10} className="text-[#60A5FA]" />
                <span className="text-xs font-bold text-white">{primaryStats.count} mods</span>
              </div>
            )}
          </div>
        </div>

        <Link
          href={`/garage/${primaryCar.id}`}
          className="absolute bottom-5 right-5 flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 transition-colors active:scale-95"
        >
          Manage <ChevronRight size={12} />
        </Link>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {/* Build Score card */}
        <div className="rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award size={15} style={{ color: levelColor }} />
              <p className="text-xs font-semibold text-[rgba(255,255,255,0.55)]">Build Score</p>
            </div>
            <Link href="/profile" className="text-[10px] font-semibold text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)] transition-colors">
              View details →
            </Link>
          </div>
          <div className="flex items-end gap-3 mb-3">
            <span className="text-3xl font-bold">{buildScore.score}</span>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full mb-1"
              style={{ background: `${levelColor}18`, color: levelColor, border: `1px solid ${levelColor}25` }}
            >
              {buildScore.level}
            </span>
          </div>
          {buildScore.nextLevel && (
            <div>
              <div className="score-bar mb-1.5">
                <div
                  className="score-bar-fill"
                  style={{
                    width: `${buildScore.progress}%`,
                    background: `linear-gradient(90deg, ${levelColor}, ${levelColor}99)`,
                  }}
                />
              </div>
              <p className="text-[10px] text-[rgba(255,255,255,0.25)]">
                {buildScore.nextThreshold! - buildScore.score} pts to {buildScore.nextLevel}
              </p>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[14px] bg-[#111111] border border-[rgba(255,255,255,0.07)] p-3 text-center">
            <p className="text-xl font-bold">{cars.length}</p>
            <p className="text-[10px] text-[rgba(255,255,255,0.28)] mt-0.5">Vehicles</p>
          </div>
          <div className="rounded-[14px] bg-[#111111] border border-[rgba(255,255,255,0.07)] p-3 text-center">
            <p className="text-xl font-bold">{totalMods}</p>
            <p className="text-[10px] text-[rgba(255,255,255,0.28)] mt-0.5">Mods</p>
          </div>
          <div className="rounded-[14px] bg-[#111111] border border-[rgba(255,255,255,0.07)] p-3 text-center">
            <p className="text-xl font-bold text-[#60A5FA]">
              {totalInvested > 0 ? formatCurrency(totalInvested) : "—"}
            </p>
            <p className="text-[10px] text-[rgba(255,255,255,0.28)] mt-0.5">Invested</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/garage/${primaryCar.id}`}
            className="rounded-[16px] bg-[#3B82F6] p-4 flex items-center justify-between hover:bg-[#60A5FA] transition-colors active:scale-[0.98]"
          >
            <div>
              <p className="text-sm font-bold text-white">Manage Build</p>
              <p className="text-[11px] text-white/60 mt-0.5">Log mods & track</p>
            </div>
            <Wrench size={19} className="text-white/70" />
          </Link>
          <Link
            href={`/visualizer?carId=${primaryCar.id}`}
            className="rounded-[16px] bg-[#111111] border border-[rgba(255,255,255,0.07)] p-4 flex items-center justify-between card-hover"
          >
            <div>
              <p className="text-sm font-bold">AI Render</p>
              <p className="text-[11px] text-[rgba(255,255,255,0.35)] mt-0.5">Visualize mods</p>
            </div>
            <Zap size={19} className="text-[#3B82F6]" />
          </Link>
        </div>

        {/* All vehicles */}
        {cars.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-3 pt-1">
              <h2 className="text-sm font-bold">All Vehicles</h2>
              <AddCarButton />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  modCount={statsMap.get(car.id)?.count ?? 0}
                  totalSpent={statsMap.get(car.id)?.total ?? 0}
                />
              ))}
            </div>
          </div>
        )}

        {cars.length === 1 && (
          <AddCarButton asCard label="Add another vehicle" />
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}
