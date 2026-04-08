"use client";

import { useMemo, useState } from "react";
import {
  Zap, Gauge, Timer, TrendingUp, Weight, Wrench, DollarSign,
  Calendar, BookmarkCheck, Star, Sparkles, ArrowRight, Car as CarIcon
} from "lucide-react";
import type { Car, ModCategory } from "@/lib/supabase/types";
import { CategoryBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate, getCategoryColor, getCategoryLabel } from "@/lib/utils";

type ModRow = {
  id: string;
  car_id: string;
  name: string;
  category: ModCategory;
  cost: number | null;
  install_date: string | null;
  status: "installed" | "wishlist";
  notes: string | null;
  created_at: string;
};

interface Props {
  cars: Car[];
  mods: ModRow[];
}

/**
 * Heuristic mod impact estimator — runs on the client so the stats page is
 * instant without a Claude call. Uses industry-typical figures (the same
 * rules the /api/ai/vehicle-specs endpoint uses server-side).
 *
 * Recognizes keywords in mod names. If the user put numbers in the notes
 * ("adds 20hp"), those override the heuristic.
 */
function estimateModImpact(mod: Pick<ModRow, "name" | "category" | "notes">): {
  hp: number;
  torque: number;
  weight: number;
  confidence: "user" | "estimated";
  category: "power" | "weight" | "aesthetic" | "handling";
} {
  const nameLower = mod.name.toLowerCase();
  const notes = (mod.notes ?? "").toLowerCase();
  const combined = `${nameLower} ${notes}`;

  // If the user has explicit numbers in notes or name, use them.
  const hpMatch = combined.match(/([+-]?\d+(?:\.\d+)?)\s*hp/);
  const tqMatch = combined.match(/([+-]?\d+(?:\.\d+)?)\s*(?:lb-?ft|tq|torque)/);
  const wtMatch = combined.match(/([+-]?\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/);

  if (hpMatch || tqMatch || wtMatch) {
    return {
      hp: hpMatch ? Math.round(parseFloat(hpMatch[1])) : 0,
      torque: tqMatch ? Math.round(parseFloat(tqMatch[1])) : 0,
      weight: wtMatch ? Math.round(parseFloat(wtMatch[1])) : 0,
      confidence: "user",
      category: "power",
    };
  }

  // Heuristic rules
  const rules: [RegExp, { hp: number; torque: number; weight: number; category: "power" | "weight" | "aesthetic" | "handling" }][] = [
    [/supercharger|supercharge/, { hp: 175, torque: 160, weight: 25, category: "power" }],
    [/turbo(?!.*back)/, { hp: 150, torque: 140, weight: 30, category: "power" }],
    [/turbo[- ]?back/, { hp: 25, torque: 20, weight: -10, category: "power" }],
    [/downpipe/, { hp: 30, torque: 25, weight: -5, category: "power" }],
    [/headers?/, { hp: 22, torque: 18, weight: -8, category: "power" }],
    [/tune|ecu|flash|stage ?\d/, { hp: 55, torque: 50, weight: 0, category: "power" }],
    [/intake/, { hp: 12, torque: 10, weight: -2, category: "power" }],
    [/cat[- ]?back/, { hp: 15, torque: 12, weight: -6, category: "power" }],
    [/muffler|axle[- ]?back/, { hp: 8, torque: 6, weight: -4, category: "power" }],
    [/exhaust/, { hp: 15, torque: 12, weight: -5, category: "power" }],
    [/nitrous|nos/, { hp: 100, torque: 80, weight: 10, category: "power" }],
    [/intercooler/, { hp: 20, torque: 18, weight: 5, category: "power" }],
    [/coilover|suspension|sway bar|endlink/, { hp: 0, torque: 0, weight: -15, category: "handling" }],
    [/wheels?|rims?/, { hp: 0, torque: 0, weight: -20, category: "weight" }],
    [/brakes?|bbk|big brake/, { hp: 0, torque: 0, weight: 12, category: "handling" }],
    [/carbon.*(hood|bonnet|bumper|trunk|spoiler|wing)/, { hp: 0, torque: 0, weight: -25, category: "weight" }],
    [/widebody|wide body|fender|overfenders/, { hp: 0, torque: 0, weight: 15, category: "aesthetic" }],
    [/spoiler|wing/, { hp: 0, torque: 0, weight: 8, category: "aesthetic" }],
    [/splitter|diffuser|aero/, { hp: 0, torque: 0, weight: 5, category: "aesthetic" }],
    [/seats?/, { hp: 0, torque: 0, weight: -20, category: "weight" }],
    [/wrap|respray|paint/, { hp: 0, torque: 0, weight: 0, category: "aesthetic" }],
    [/lights?|led|hid/, { hp: 0, torque: 0, weight: 0, category: "aesthetic" }],
  ];

  for (const [re, impact] of rules) {
    if (re.test(combined)) return { ...impact, confidence: "estimated" };
  }

  // Category fallback
  const categoryFallback: Record<ModCategory, { hp: number; torque: number; weight: number; category: "power" | "weight" | "aesthetic" | "handling" }> = {
    engine: { hp: 10, torque: 8, weight: 0, category: "power" },
    exhaust: { hp: 10, torque: 8, weight: -5, category: "power" },
    electronics: { hp: 5, torque: 3, weight: 0, category: "power" },
    suspension: { hp: 0, torque: 0, weight: -10, category: "handling" },
    wheels: { hp: 0, torque: 0, weight: -10, category: "weight" },
    aero: { hp: 0, torque: 0, weight: 5, category: "aesthetic" },
    interior: { hp: 0, torque: 0, weight: -5, category: "weight" },
    other: { hp: 0, torque: 0, weight: 0, category: "aesthetic" },
  };
  return { ...categoryFallback[mod.category], confidence: "estimated" };
}

export function StatsVehicleIntelligence({ cars, mods }: Props) {
  const [selectedCarId, setSelectedCarId] = useState(
    () => cars.find((c) => c.is_primary)?.id ?? cars[0]?.id ?? ""
  );
  const [showStock, setShowStock] = useState(false);
  const [includeWishlist, setIncludeWishlist] = useState(false);

  const selectedCar = cars.find((c) => c.id === selectedCarId) ?? null;

  const { installed, wishlist } = useMemo(() => {
    const carMods = mods.filter((m) => m.car_id === selectedCarId);
    return {
      installed: carMods.filter((m) => m.status === "installed"),
      wishlist: carMods.filter((m) => m.status === "wishlist"),
    };
  }, [mods, selectedCarId]);

  const modImpacts = useMemo(() => {
    return installed.map((m) => ({ ...m, impact: estimateModImpact(m) }));
  }, [installed]);

  const wishlistImpacts = useMemo(() => {
    return wishlist.map((m) => ({ ...m, impact: estimateModImpact(m) }));
  }, [wishlist]);

  const totalHpGain = modImpacts.reduce((s, m) => s + m.impact.hp, 0);
  const totalTorqueGain = modImpacts.reduce((s, m) => s + m.impact.torque, 0);
  const totalWeightChange = modImpacts.reduce((s, m) => s + m.impact.weight, 0);
  const totalSpent = installed.reduce((s, m) => s + (m.cost ?? 0), 0);

  const wishlistHp = wishlistImpacts.reduce((s, m) => s + m.impact.hp, 0);
  const wishlistTorque = wishlistImpacts.reduce((s, m) => s + m.impact.torque, 0);
  const wishlistWeight = wishlistImpacts.reduce((s, m) => s + m.impact.weight, 0);
  const wishlistCost = wishlist.reduce((s, m) => s + (m.cost ?? 0), 0);

  // STOCK baseline always comes from the dedicated stock_* columns first,
  // never derived by subtracting mod gains from the user's current figure
  // (that math only works when the user already updated `horsepower` after
  // installing mods, which most people don't). If stock_* is missing, we
  // treat the current-spec field as the stock value — both the same number
  // is safer than showing a lower-than-stock figure.
  const stockHp     = selectedCar?.stock_horsepower ?? selectedCar?.horsepower     ?? null;
  const stockTorque = selectedCar?.stock_torque     ?? selectedCar?.torque         ?? null;
  const stockWeight = selectedCar?.stock_curb_weight ?? selectedCar?.curb_weight   ?? null;

  // CURRENT is the larger of (user-reported horsepower) or (stock + mod gains).
  // This way, if the user manually logged a dyno sheet it wins; otherwise we
  // derive it cleanly from stock + estimated mod gains.
  const currentHp = stockHp != null
    ? Math.max(selectedCar?.horsepower ?? 0, stockHp + totalHpGain)
    : selectedCar?.horsepower ?? null;
  const currentTorque = stockTorque != null
    ? Math.max(selectedCar?.torque ?? 0, stockTorque + totalTorqueGain)
    : selectedCar?.torque ?? null;
  const currentWeight = stockWeight != null
    ? (selectedCar?.curb_weight ?? stockWeight + totalWeightChange)
    : selectedCar?.curb_weight ?? null;

  const projectedHp     = currentHp     != null ? currentHp     + wishlistHp     : null;
  const projectedTorque = currentTorque != null ? currentTorque + wishlistTorque : null;
  const projectedWeight = currentWeight != null ? currentWeight + wishlistWeight : null;

  const displayHp = showStock ? stockHp : includeWishlist ? projectedHp : currentHp;
  const displayTorque = showStock ? stockTorque : includeWishlist ? projectedTorque : currentTorque;
  const displayWeight = showStock ? stockWeight : includeWishlist ? projectedWeight : currentWeight;

  // Sort installed mods by install date for the timeline
  const timelineMods = [...modImpacts].sort((a, b) => {
    const aDate = new Date(a.install_date ?? a.created_at).getTime();
    const bDate = new Date(b.install_date ?? b.created_at).getTime();
    return bDate - aDate;
  });

  if (cars.length === 0) {
    return (
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] py-16 text-center">
        <CarIcon size={28} className="mx-auto text-[var(--color-text-disabled)] mb-3" />
        <p className="font-bold text-[var(--color-text-secondary)]">No vehicles yet</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 max-w-xs mx-auto">
          Add a car in your garage to see build stats
        </p>
      </div>
    );
  }

  if (!selectedCar) return null;

  return (
    <div className="space-y-6">
      {/* Car switcher */}
      {cars.length > 1 && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 pb-1">
          {cars.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCarId(c.id)}
              className={`flex-shrink-0 flex items-center gap-2 min-h-[44px] h-11 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                selectedCarId === c.id
                  ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)]"
              }`}
            >
              {c.is_primary && <Star size={11} fill="currentColor" className="text-[#fbbf24]" />}
              <span className="truncate max-w-[180px]">
                {c.year} {c.make} {c.model}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ═════ BUILD OVERVIEW ═════ */}
      <section>
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 overflow-hidden relative">
          {/* Glow accent */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 60%)",
            }}
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div className="min-w-0">
                {selectedCar.nickname && (
                  <p className="text-[10px] font-bold text-[#60A5FA] uppercase tracking-[0.15em] mb-1 truncate">
                    {selectedCar.nickname}
                  </p>
                )}
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight break-words">
                  {selectedCar.year} {selectedCar.make} {selectedCar.model}
                </h2>
                {selectedCar.trim && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{selectedCar.trim}</p>
                )}
              </div>
              {selectedCar.specs_ai_guessed && (
                <span className="tag bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)] flex-shrink-0">
                  <Sparkles size={9} className="inline mr-0.5" /> AI specs
                </span>
              )}
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                type="button"
                onClick={() => { setShowStock(false); setIncludeWishlist(false); }}
                className={`min-h-[36px] h-9 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  !showStock && !includeWishlist
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => { setShowStock(true); setIncludeWishlist(false); }}
                className={`min-h-[36px] h-9 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  showStock
                    ? "bg-white text-black"
                    : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                Stock baseline
              </button>
              {wishlist.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setIncludeWishlist(true); setShowStock(false); }}
                  className={`min-h-[36px] h-9 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    includeWishlist
                      ? "bg-[#fbbf24] text-black"
                      : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                >
                  + Wishlist ({wishlist.length})
                </button>
              )}
            </div>

            {/* Big stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <BigStat
                icon={<Zap size={13} />}
                label="Horsepower"
                value={displayHp}
                unit="hp"
                accent="#fbbf24"
                delta={!showStock && totalHpGain > 0 ? `+${totalHpGain} from mods` : null}
                wishlistDelta={includeWishlist && wishlistHp > 0 ? `+${wishlistHp} projected` : null}
              />
              <BigStat
                icon={<TrendingUp size={13} />}
                label="Torque"
                value={displayTorque}
                unit="lb-ft"
                accent="#30d158"
                delta={!showStock && totalTorqueGain > 0 ? `+${totalTorqueGain} from mods` : null}
                wishlistDelta={includeWishlist && wishlistTorque > 0 ? `+${wishlistTorque} projected` : null}
              />
              <BigStat
                icon={<Timer size={13} />}
                label="0–60"
                value={selectedCar.zero_to_sixty}
                unit="sec"
                accent="#60A5FA"
              />
              <BigStat
                icon={<Gauge size={13} />}
                label="Top Speed"
                value={selectedCar.top_speed}
                unit="mph"
                accent="#ff453a"
              />
            </div>

            {/* Secondary row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              <SecondaryStat
                icon={<Weight size={11} />}
                label="Weight"
                value={displayWeight != null ? `${displayWeight.toLocaleString()} lbs` : "—"}
                delta={!showStock && totalWeightChange !== 0
                  ? `${totalWeightChange > 0 ? "+" : ""}${totalWeightChange} lbs`
                  : null}
                deltaPositive={totalWeightChange < 0}
              />
              <SecondaryStat
                icon={<Wrench size={11} />}
                label="Installed mods"
                value={`${installed.length}`}
              />
              <SecondaryStat
                icon={<DollarSign size={11} />}
                label="Total spent"
                value={totalSpent > 0 ? formatCurrency(totalSpent) : "—"}
              />
            </div>

            {/* Mod journey row */}
            {stockHp != null && totalHpGain > 0 && (
              <div className="mt-5 rounded-2xl bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.22)] p-4">
                <p className="text-[10px] font-bold text-[#60A5FA] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <TrendingUp size={11} />
                  HP journey
                </p>
                <div className="flex items-center gap-3">
                  <div className="text-center flex-1">
                    <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-0.5">Stock</p>
                    <p className="text-lg sm:text-2xl font-black tabular text-white">{stockHp}</p>
                  </div>
                  <ArrowRight size={14} className="text-[#60A5FA] flex-shrink-0" />
                  <div className="text-center flex-1">
                    <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-0.5">Now</p>
                    <p className="text-lg sm:text-2xl font-black tabular text-[#60A5FA]">{currentHp}</p>
                  </div>
                  {wishlistHp > 0 && projectedHp != null && (
                    <>
                      <ArrowRight size={14} className="text-[#fbbf24] flex-shrink-0" />
                      <div className="text-center flex-1">
                        <p className="text-[9px] text-[#fbbf24] font-bold uppercase tracking-wider mb-0.5">Projected</p>
                        <p className="text-lg sm:text-2xl font-black tabular text-[#fbbf24]">{projectedHp}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═════ MOD IMPACT TIMELINE ═════ */}
      <section>
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight">Mod Impact Timeline</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
              Every mod, what it did, and when it went in
            </p>
          </div>
        </div>

        {timelineMods.length === 0 ? (
          <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-8 text-center">
            <Wrench size={22} className="mx-auto text-[var(--color-text-disabled)] mb-2" />
            <p className="text-sm font-bold text-[var(--color-text-secondary)]">No installed mods yet</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Log a mod to start the timeline</p>
          </div>
        ) : (
          <div className="space-y-2">
            {timelineMods.map((mod) => (
              <TimelineEntry key={mod.id} mod={mod} />
            ))}
          </div>
        )}
      </section>

      {/* ═════ WISHLIST PREVIEW ═════ */}
      {wishlist.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                <BookmarkCheck size={16} className="text-[#fbbf24]" />
                Wishlist Projection
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                What happens if you add all {wishlist.length} wishlist mods
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[rgba(251,191,36,0.25)] p-6 space-y-4">
            {/* Projected stats comparison */}
            {stockHp != null && currentHp != null && projectedHp != null && (
              <div className="grid grid-cols-3 gap-3">
                <ProjectionCard label="Stock" hp={stockHp} tq={stockTorque} weight={stockWeight} color="#888" />
                <ProjectionCard label="Current" hp={currentHp} tq={currentTorque} weight={currentWeight} color="#60A5FA" />
                <ProjectionCard label="Projected" hp={projectedHp} tq={projectedTorque} weight={projectedWeight} color="#fbbf24" />
              </div>
            )}

            {/* Wishlist items */}
            <div className="space-y-2">
              {wishlistImpacts.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{mod.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CategoryBadge category={mod.category} className="text-[9px]" />
                      {mod.cost != null && (
                        <span className="text-[10px] text-[var(--color-text-muted)] font-bold tabular">
                          {formatCurrency(mod.cost)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {mod.impact.hp !== 0 && <DeltaBadge value={`+${mod.impact.hp}hp`} positive />}
                    {mod.impact.torque !== 0 && <DeltaBadge value={`+${mod.impact.torque}tq`} positive />}
                  </div>
                </div>
              ))}
            </div>

            {/* Total wishlist cost */}
            {wishlistCost > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Wishlist total
                </p>
                <p className="text-lg font-black tabular text-[#fbbf24]">{formatCurrency(wishlistCost)}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════

function BigStat({
  icon,
  label,
  value,
  unit,
  accent,
  delta,
  wishlistDelta,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  unit: string;
  accent: string;
  delta?: string | null;
  wishlistDelta?: string | null;
}) {
  const display = value == null || value === 0
    ? "—"
    : unit === "sec"
    ? value.toFixed(1)
    : Math.round(value).toLocaleString();

  return (
    <div
      className="rounded-2xl p-4 border"
      style={{
        background: `linear-gradient(135deg, ${accent}0d 0%, rgba(18,18,20,0.4) 100%)`,
        borderColor: `${accent}22`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2" style={{ color: accent }}>
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <p
          className="text-2xl sm:text-3xl font-black leading-none tabular"
          style={{ color: display === "—" ? "var(--color-text-disabled)" : "white" }}
        >
          {display}
        </p>
        {display !== "—" && (
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{unit}</span>
        )}
      </div>
      {wishlistDelta ? (
        <p className="text-[9px] font-bold text-[#fbbf24] mt-1 truncate">{wishlistDelta}</p>
      ) : delta ? (
        <p className="text-[9px] font-bold text-[#30d158] mt-1 truncate">{delta}</p>
      ) : null}
    </div>
  );
}

function SecondaryStat({
  icon,
  label,
  value,
  delta,
  deltaPositive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: string | null;
  deltaPositive?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-3">
      <div className="flex items-center gap-1 text-[var(--color-text-muted)] mb-1">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-bold text-white truncate">{value}</p>
      {delta && (
        <p
          className="text-[10px] font-bold tabular mt-0.5"
          style={{ color: deltaPositive ? "#30d158" : "#ff9f0a" }}
        >
          {delta}
        </p>
      )}
    </div>
  );
}

function TimelineEntry({
  mod,
}: {
  mod: ModRow & {
    impact: ReturnType<typeof estimateModImpact>;
  };
}) {
  const color = getCategoryColor(mod.category);
  const hasPerformance = mod.impact.hp !== 0 || mod.impact.torque !== 0 || mod.impact.weight !== 0;
  const date = mod.install_date ?? mod.created_at;

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}1a`, color }}
      >
        <Wrench size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold text-white truncate">{mod.name}</p>
          {mod.cost != null && (
            <p className="text-sm font-bold tabular text-[var(--color-accent-bright)] flex-shrink-0">
              {formatCurrency(mod.cost)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <CategoryBadge category={mod.category} className="text-[9px]" />
          {mod.install_date && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] font-bold">
              <Calendar size={9} />
              {formatDate(date)}
            </span>
          )}
        </div>
        {hasPerformance ? (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {mod.impact.hp !== 0 && (
              <DeltaBadge value={`${mod.impact.hp > 0 ? "+" : ""}${mod.impact.hp}hp`} positive={mod.impact.hp > 0} />
            )}
            {mod.impact.torque !== 0 && (
              <DeltaBadge value={`${mod.impact.torque > 0 ? "+" : ""}${mod.impact.torque}tq`} positive={mod.impact.torque > 0} />
            )}
            {mod.impact.weight !== 0 && (
              <DeltaBadge
                value={`${mod.impact.weight > 0 ? "+" : ""}${mod.impact.weight}lbs`}
                positive={mod.impact.weight < 0}
              />
            )}
            {mod.impact.confidence === "estimated" && (
              <span className="tag bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)] text-[9px]">
                <Sparkles size={8} className="inline mr-0.5" /> est
              </span>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 italic">
            {getCategoryLabel(mod.category)} upgrade — no performance change
          </p>
        )}
      </div>
    </div>
  );
}

function DeltaBadge({ value, positive }: { value: string; positive: boolean }) {
  return (
    <span
      className="text-[10px] font-bold tabular px-1.5 py-0.5 rounded"
      style={{
        color: positive ? "#30d158" : "#ff9f0a",
        backgroundColor: positive ? "rgba(48,209,88,0.12)" : "rgba(255,159,10,0.12)",
      }}
    >
      {value}
    </span>
  );
}

function ProjectionCard({
  label,
  hp,
  tq,
  weight,
  color,
}: {
  label: string;
  hp: number | null;
  tq: number | null;
  weight: number | null;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-3 text-center border"
      style={{ borderColor: `${color}33`, backgroundColor: `${color}0a` }}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color }}>
        {label}
      </p>
      <p className="text-xl font-black tabular text-white">
        {hp ?? "—"}
        <span className="text-[10px] text-[var(--color-text-muted)] font-bold ml-0.5">hp</span>
      </p>
      <div className="text-[10px] text-[var(--color-text-muted)] font-semibold tabular mt-0.5">
        {tq ? `${tq} tq` : "—"}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] font-semibold tabular">
        {weight ? `${weight.toLocaleString()} lbs` : "—"}
      </div>
    </div>
  );
}
