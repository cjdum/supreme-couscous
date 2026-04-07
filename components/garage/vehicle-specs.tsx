"use client";

import { useState } from "react";
import {
  Zap, Gauge, Weight, Timer, Sparkles, RefreshCw, Loader2, TrendingUp, ArrowRight
} from "lucide-react";
import type { Car } from "@/lib/supabase/types";

interface VehicleSpecsProps {
  car: Car;
  onUpdate?: (specs: Partial<Car>) => void;
}

type StockSpecs = {
  horsepower: number | null;
  torque: number | null;
  engine_size: string | null;
  drivetrain: string | null;
  transmission: string | null;
  curb_weight: number | null;
  zero_to_sixty: number | null;
  top_speed: number | null;
};

type ModifiedSpecs = {
  horsepower: number;
  torque: number;
  engine_size: string;
  drivetrain: string;
  transmission: string;
  curb_weight: number;
  zero_to_sixty: number;
  top_speed: number;
};

type ModDelta = {
  name: string;
  category: string;
  hp: number;
  torque: number;
  weight: number;
  zero_to_sixty: number;
  top_speed: number;
  note: string;
};

// Scale markers for the HP / torque bars
const HP_SCALE_MAX = 1000;
const TORQUE_SCALE_MAX = 900;
const TOP_SPEED_MAX = 250;

export function VehicleSpecs({ car, onUpdate }: VehicleSpecsProps) {
  const [guessing, setGuessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stock, setStock] = useState<StockSpecs | null>(null);
  const [modified, setModified] = useState<ModifiedSpecs | null>(null);
  const [modDeltas, setModDeltas] = useState<ModDelta[]>([]);
  const [showStock, setShowStock] = useState(false);
  const [localCar, setLocalCar] = useState<Car>(car);

  const hasSpecs =
    localCar.horsepower != null ||
    localCar.torque != null ||
    localCar.zero_to_sixty != null ||
    localCar.top_speed != null;

  async function handleGuessSpecs() {
    setGuessing(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/vehicle-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: car.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to get specs");

      if (json.stock && json.modified) {
        setStock(json.stock as StockSpecs);
        setModified(json.modified as ModifiedSpecs);
        setModDeltas((json.mod_deltas ?? []) as ModDelta[]);
      }

      // Keep the underlying car row in sync so other parts of the UI read the
      // latest modified figures.
      setLocalCar((prev) => ({ ...prev, ...json.specs, specs_ai_guessed: true }));
      onUpdate?.(json.specs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get specs");
    } finally {
      setGuessing(false);
    }
  }

  // Derive display figures — prefer fresh API data, fall back to stored car row.
  const displayStock: StockSpecs = stock ?? {
    horsepower: null,
    torque: null,
    engine_size: null,
    drivetrain: null,
    transmission: null,
    curb_weight: null,
    zero_to_sixty: null,
    top_speed: null,
  };

  const displayModified: ModifiedSpecs | null = modified ?? (
    hasSpecs
      ? {
          horsepower: localCar.horsepower ?? 0,
          torque: localCar.torque ?? 0,
          engine_size: localCar.engine_size ?? "—",
          drivetrain: localCar.drivetrain ?? "—",
          transmission: localCar.transmission ?? "—",
          curb_weight: localCar.curb_weight ?? 0,
          zero_to_sixty: localCar.zero_to_sixty ?? 0,
          top_speed: localCar.top_speed ?? 0,
        }
      : null
  );

  if (!hasSpecs && !displayModified) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Vehicle Specs</h3>
        </div>
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center mx-auto mb-3">
            <Sparkles size={18} className="text-[var(--color-accent-bright)]" />
          </div>
          <p className="text-sm font-bold text-[var(--color-text-secondary)] mb-1">No specs yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            AI will estimate stock figures and factor in every installed mod.
          </p>
          <button
            onClick={handleGuessSpecs}
            disabled={guessing}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold disabled:opacity-50 cursor-pointer hover:brightness-110"
          >
            {guessing ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Calculating…
              </>
            ) : (
              <>
                <Zap size={13} /> Calculate specs
              </>
            )}
          </button>
          {error && <p className="mt-3 text-[11px] text-[var(--color-danger)]">{error}</p>}
        </div>
      </div>
    );
  }

  // Active display — either modified or stock depending on toggle
  const active: ModifiedSpecs | StockSpecs = showStock ? displayStock : (displayModified ?? displayStock);
  const isAI = localCar.specs_ai_guessed;

  // Find mod contributions for the main stats
  const hpMods = modDeltas.filter((d) => d.hp !== 0);
  const torqueMods = modDeltas.filter((d) => d.torque !== 0);
  const weightMods = modDeltas.filter((d) => d.weight !== 0);
  const accelMods = modDeltas.filter((d) => d.zero_to_sixty !== 0);

  const totalHpGain = hpMods.reduce((s, d) => s + d.hp, 0);
  const totalTorqueGain = torqueMods.reduce((s, d) => s + d.torque, 0);
  const totalWeightChange = weightMods.reduce((s, d) => s + d.weight, 0);
  const totalAccelGain = accelMods.reduce((s, d) => s + d.zero_to_sixty, 0);

  return (
    <div>
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold truncate">Vehicle Specs</h3>
          {isAI && (
            <span className="tag bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)] flex-shrink-0">
              AI
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleGuessSpecs}
            disabled={guessing}
            className="min-h-[36px] w-9 h-9 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-border-bright)] disabled:opacity-50 cursor-pointer"
            aria-label="Refresh specs"
          >
            {guessing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
          </button>
        </div>
      </div>

      {/* Stock vs Modified toggle */}
      {(stock || hasSpecs) && modDeltas.length > 0 && (
        <div className="flex mb-3 p-1 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setShowStock(false)}
            className={`flex-1 min-h-[36px] h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              !showStock
                ? "bg-[var(--color-accent)] text-white shadow-sm"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            Modified
          </button>
          <button
            type="button"
            onClick={() => setShowStock(true)}
            className={`flex-1 min-h-[36px] h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              showStock
                ? "bg-[var(--color-bg-card)] text-white shadow-sm"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            Stock
          </button>
        </div>
      )}

      {/* Main stat cards — big numbers, driver's license aesthetic */}
      <div className="grid grid-cols-2 gap-2.5">
        <BigStatCard
          icon={<Zap size={13} />}
          label="Horsepower"
          value={active.horsepower}
          unit="hp"
          accent="#fbbf24"
          delta={!showStock && totalHpGain !== 0 ? totalHpGain : null}
          deltaLabel={hpMods.length > 0 ? `from ${hpMods.length} ${hpMods.length === 1 ? "mod" : "mods"}` : null}
          barMax={HP_SCALE_MAX}
        />
        <BigStatCard
          icon={<TrendingUp size={13} />}
          label="Torque"
          value={active.torque}
          unit="lb-ft"
          accent="#30d158"
          delta={!showStock && totalTorqueGain !== 0 ? totalTorqueGain : null}
          deltaLabel={torqueMods.length > 0 ? `from ${torqueMods.length} ${torqueMods.length === 1 ? "mod" : "mods"}` : null}
          barMax={TORQUE_SCALE_MAX}
        />
        <BigStatCard
          icon={<Timer size={13} />}
          label="0–60 mph"
          value={active.zero_to_sixty}
          unit="sec"
          accent="#60A5FA"
          delta={!showStock && totalAccelGain !== 0 ? totalAccelGain : null}
          deltaLabel={accelMods.length > 0 ? `from ${accelMods.length} ${accelMods.length === 1 ? "mod" : "mods"}` : null}
          lowerIsBetter
        />
        <BigStatCard
          icon={<Gauge size={13} />}
          label="Top Speed"
          value={active.top_speed}
          unit="mph"
          accent="#ff453a"
          barMax={TOP_SPEED_MAX}
        />
      </div>

      {/* Secondary specs */}
      <div className="grid grid-cols-2 gap-2.5 mt-2.5">
        <SmallStatCard
          icon={<Weight size={11} />}
          label="Weight"
          value={active.curb_weight != null ? `${Number(active.curb_weight).toLocaleString()} lbs` : "—"}
          delta={!showStock && totalWeightChange !== 0
            ? `${totalWeightChange > 0 ? "+" : ""}${totalWeightChange} lbs`
            : null}
        />
        <SmallStatCard
          icon={<Sparkles size={11} />}
          label="Drivetrain"
          value={active.drivetrain ?? "—"}
        />
      </div>

      {/* Engine and transmission — less prominent */}
      {(active.engine_size || active.transmission) && (
        <div className="mt-2.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-3 space-y-1.5">
          {active.engine_size && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex-shrink-0">Engine</span>
              <span className="text-[11px] text-white font-semibold truncate text-right">{active.engine_size}</span>
            </div>
          )}
          {active.transmission && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex-shrink-0">Trans</span>
              <span className="text-[11px] text-white font-semibold truncate text-right">{active.transmission}</span>
            </div>
          )}
        </div>
      )}

      {/* Mod breakdown — what each mod contributed */}
      {!showStock && modDeltas.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            What your mods added
          </p>
          <div className="space-y-1.5">
            {modDeltas
              .filter((d) => d.hp !== 0 || d.torque !== 0 || d.weight !== 0)
              .slice(0, 6)
              .map((d, i) => (
                <div
                  key={`${d.name}-${i}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
                >
                  <p className="text-[11px] font-semibold text-white truncate flex-1 min-w-0">{d.name}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {d.hp !== 0 && (
                      <span
                        className="text-[10px] font-bold tabular px-1.5 py-0.5 rounded"
                        style={{
                          color: d.hp > 0 ? "#30d158" : "#ff453a",
                          backgroundColor: d.hp > 0 ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.12)",
                        }}
                      >
                        {d.hp > 0 ? "+" : ""}{d.hp}hp
                      </span>
                    )}
                    {d.weight !== 0 && (
                      <span
                        className="text-[10px] font-bold tabular px-1.5 py-0.5 rounded"
                        style={{
                          color: d.weight < 0 ? "#30d158" : "#ff9f0a",
                          backgroundColor: d.weight < 0 ? "rgba(48,209,88,0.12)" : "rgba(255,159,10,0.12)",
                        }}
                      >
                        {d.weight > 0 ? "+" : ""}{d.weight}lbs
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Projected card — if user has both stock and modified, show the journey */}
      {stock && displayModified && stock.horsepower != null && (
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-[var(--color-accent-muted)] to-transparent border border-[rgba(59,130,246,0.25)] p-4">
          <p className="text-[10px] font-bold text-[var(--color-accent-bright)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <TrendingUp size={11} />
            Your HP journey
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="text-center flex-1">
              <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Stock</p>
              <p className="text-xl font-black text-white tabular">{stock.horsepower}</p>
            </div>
            <ArrowRight size={16} className="text-[var(--color-accent-bright)] flex-shrink-0" />
            <div className="text-center flex-1">
              <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Now</p>
              <p className="text-xl font-black text-[#60A5FA] tabular">{displayModified.horsepower}</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Gained</p>
              <p className="text-xl font-black text-[#30d158] tabular">
                +{displayModified.horsepower - stock.horsepower}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-[11px] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

function BigStatCard({
  icon,
  label,
  value,
  unit,
  accent,
  delta,
  deltaLabel,
  barMax,
  lowerIsBetter,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string | null;
  unit: string;
  accent: string;
  delta?: number | null;
  deltaLabel?: string | null;
  barMax?: number;
  lowerIsBetter?: boolean;
}) {
  const displayValue =
    value == null || value === "" || value === 0
      ? "—"
      : typeof value === "number" && unit === "sec"
      ? value.toFixed(1)
      : typeof value === "number"
      ? Math.round(value).toLocaleString()
      : value;

  const barPct = barMax && typeof value === "number" && value > 0
    ? Math.min(100, (value / barMax) * 100)
    : null;

  const deltaColor = delta != null
    ? (lowerIsBetter ? (delta < 0 ? "#30d158" : "#ff9f0a") : (delta > 0 ? "#30d158" : "#ff9f0a"))
    : null;

  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden border"
      style={{
        background: `linear-gradient(135deg, ${accent}0d 0%, rgba(18,18,20,0.5) 100%)`,
        borderColor: `${accent}22`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2" style={{ color: accent }}>
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-0.5">
        <p
          className="text-3xl font-black leading-none tabular"
          style={{ color: displayValue === "—" ? "var(--color-text-disabled)" : "white" }}
        >
          {displayValue}
        </p>
        {displayValue !== "—" && (
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{unit}</span>
        )}
      </div>
      {delta != null && delta !== 0 && (
        <p className="text-[9px] font-bold" style={{ color: deltaColor ?? undefined }}>
          {delta > 0 ? "+" : ""}{lowerIsBetter ? delta.toFixed(1) : delta}
          {unit === "sec" ? "s" : unit === "mph" ? "mph" : unit === "lb-ft" ? "lb-ft" : unit === "hp" ? "hp" : ""}
          {deltaLabel ? ` • ${deltaLabel}` : ""}
        </p>
      )}
      {barPct != null && (
        <div className="mt-2.5 h-1 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${barPct}%`, backgroundColor: accent }}
          />
        </div>
      )}
    </div>
  );
}

function SmallStatCard({
  icon,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: string | null;
}) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-3">
      <div className="flex items-center gap-1 text-[var(--color-text-muted)] mb-1">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-bold text-white truncate">{value}</p>
      {delta && (
        <p className="text-[10px] font-bold text-[#30d158] tabular mt-0.5">{delta}</p>
      )}
    </div>
  );
}
