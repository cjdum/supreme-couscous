import Link from "next/link";
import { ChevronRight, Wrench, Zap, TrendingUp, Award, Star, Plus } from "lucide-react";
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
  const cars = ((carsRaw ?? []) as CarType[]).sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return 0;
  });

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

  const primaryCar = cars.find((c) => c.is_primary) ?? cars[0];
  const primaryStats = statsMap.get(primaryCar.id) ?? { count: 0, total: 0 };
  const otherCars = cars.filter((c) => c.id !== primaryCar.id);

  const totalMods = Array.from(statsMap.values()).reduce((s, v) => s + v.count, 0);
  const totalInvested = Array.from(statsMap.values()).reduce((s, v) => s + v.total, 0);

  const buildScore = calculateBuildScore({
    cars: cars as Parameters<typeof calculateBuildScore>[0]["cars"],
    mods: modStats,
  });
  const levelColor = LEVEL_COLORS[buildScore.level];

  return (
    <div className="min-h-dvh">
      {/* ── Hero: Primary Car — Full viewport ── */}
      <div className="relative w-full" style={{ height: "100vh", maxHeight: "680px", minHeight: "400px" }}>
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
              background: `radial-gradient(ellipse at 20% 40%, rgba(59,130,246,0.15) 0%, transparent 55%),
                           radial-gradient(ellipse at 80% 20%, rgba(48,209,88,0.04) 0%, transparent 50%),
                           linear-gradient(160deg, rgba(59,130,246,0.06) 0%, #000 50%)`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 200 90" width="220" height="100" fill="none" aria-hidden="true" style={{ opacity: 0.03 }}>
                <path d="M18 72l16-42h132l16 42H18z" stroke="white" strokeWidth="3" strokeLinejoin="round" />
                <path d="M34 44l12-22h108l12 22H34z" stroke="white" strokeWidth="2" strokeLinejoin="round" fill="white" fillOpacity="0.03" />
                <ellipse cx="50" cy="74" rx="10" ry="10" stroke="white" strokeWidth="3" />
                <ellipse cx="150" cy="74" rx="10" ry="10" stroke="white" strokeWidth="3" />
              </svg>
            </div>
          </div>
        )}

        {/* Dark gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />

        {/* Primary label */}
        {cars.find((c) => c.is_primary) && (
          <div className="absolute top-20 left-5">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase"
              style={{
                backgroundColor: "rgba(251,191,36,0.10)",
                border: "1px solid rgba(251,191,36,0.20)",
                color: "#fbbf24",
                backdropFilter: "blur(12px)",
              }}
            >
              <Star size={9} fill="currentColor" /> Primary Build
            </div>
          </div>
        )}

        {/* Car info overlay — bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-8">
          <div className="max-w-2xl">
            {primaryCar.nickname && (
              <p className="text-xs font-bold text-[#60A5FA] mb-2 tracking-[0.15em] uppercase animate-in">
                {primaryCar.nickname}
              </p>
            )}
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-[1.1] mb-2 tracking-tight">
              {primaryCar.year} {primaryCar.make}<br />
              <span className="text-gradient">{primaryCar.model}</span>
            </h1>
            {primaryCar.trim && (
              <p className="text-sm text-white/35 mb-5 font-medium">{primaryCar.trim}</p>
            )}

            {/* Floating stat chips */}
            <div className="flex items-center gap-2.5 flex-wrap mb-6">
              {primaryCar.horsepower && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]">
                  <Zap size={11} className="text-[#fbbf24]" />
                  <span className="text-xs font-bold text-white">{primaryCar.horsepower} hp</span>
                </div>
              )}
              {primaryCar.torque && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]">
                  <TrendingUp size={11} className="text-[#30d158]" />
                  <span className="text-xs font-bold text-white">{primaryCar.torque} lb-ft</span>
                </div>
              )}
              {primaryStats.count > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]">
                  <Wrench size={11} className="text-[#60A5FA]" />
                  <span className="text-xs font-bold text-white">{primaryStats.count} mods</span>
                </div>
              )}
              {primaryStats.total > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]">
                  <span className="text-xs font-bold text-white">{formatCurrency(primaryStats.total)}</span>
                </div>
              )}
            </div>

            <Link
              href={`/garage/${primaryCar.id}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90 transition-all active:scale-95 shadow-[0_4px_24px_rgba(255,255,255,0.1)]"
            >
              Manage Build <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-4 relative z-10 space-y-4 max-w-2xl mx-auto stagger-children">
        {/* Build Score + Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Build Score card */}
          <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <Award size={16} style={{ color: levelColor }} />
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Build Score</p>
              </div>
              <Link href="/profile" className="text-[10px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
                Details
              </Link>
            </div>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-4xl font-bold tabular-nums">{buildScore.score}</span>
              <span
                className="text-[10px] font-bold px-3 py-1 rounded-full mb-1.5"
                style={{ background: `${levelColor}15`, color: levelColor, border: `1px solid ${levelColor}20` }}
              >
                {buildScore.level}
              </span>
            </div>
            {buildScore.nextLevel && (
              <div>
                <div className="score-bar mb-2">
                  <div
                    className="score-bar-fill"
                    style={{
                      width: `${buildScore.progress}%`,
                      background: `linear-gradient(90deg, ${levelColor}, ${levelColor}99)`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {buildScore.nextThreshold! - buildScore.score} pts to {buildScore.nextLevel}
                </p>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 text-center flex flex-col justify-center">
              <p className="text-2xl font-bold">{cars.length}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 font-medium">Vehicles</p>
            </div>
            <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 text-center flex flex-col justify-center">
              <p className="text-2xl font-bold">{totalMods}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 font-medium">Mods</p>
            </div>
            <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 text-center flex flex-col justify-center">
              <p className="text-2xl font-bold text-[#60A5FA]">
                {totalInvested > 0 ? formatCurrency(totalInvested) : "—"}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 font-medium">Invested</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/garage/${primaryCar.id}`}
            className="rounded-2xl bg-[var(--color-accent)] p-5 flex items-center justify-between hover:brightness-110 transition-all active:scale-[0.98] shadow-[0_4px_24px_rgba(59,130,246,0.25)]"
          >
            <div>
              <p className="text-sm font-bold text-white">Manage Build</p>
              <p className="text-[11px] text-white/60 mt-0.5">Log mods & track</p>
            </div>
            <Wrench size={20} className="text-white/60" />
          </Link>
          <Link
            href={`/visualizer?carId=${primaryCar.id}`}
            className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex items-center justify-between card-hover"
          >
            <div>
              <p className="text-sm font-bold">AI Render</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Visualize mods</p>
            </div>
            <Zap size={20} className="text-[var(--color-accent)]" />
          </Link>
        </div>

        {/* Other vehicles — horizontal scroll strip */}
        {otherCars.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[var(--color-text-secondary)]">Other Vehicles</h2>
              <AddCarButton />
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 -mx-5 px-5">
              {otherCars.map((car) => (
                <div key={car.id} className="flex-shrink-0" style={{ width: "180px" }}>
                  <CarCard
                    car={car}
                    modCount={statsMap.get(car.id)?.count ?? 0}
                    totalSpent={statsMap.get(car.id)?.total ?? 0}
                    isPrimary={false}
                    compact
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single-car: add another */}
        {cars.length === 1 && (
          <AddCarButton asCard label="Add another vehicle" />
        )}
      </div>

      {/* Floating Add Car button */}
      {cars.length > 0 && (
        <AddCarButton fab />
      )}

      <div className="h-8" />
    </div>
  );
}
