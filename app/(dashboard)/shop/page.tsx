"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShoppingBag, Sparkles, Loader2, Wrench, Copy, Check, ChevronDown,
  ThumbsUp, ThumbsDown, Hammer
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/input";
import { Autocomplete } from "@/components/ui/autocomplete";
import { searchMods } from "@/lib/vehicle-data";
import { MOD_CATEGORIES } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { Car, ModCategory } from "@/lib/supabase/types";

interface PartRecommendation {
  product: string;
  brand: string;
  partNumber: string | null;
  priceRange: string;
  fitsBecause: string;
  difficulty: "Bolt-on" | "Moderate" | "Advanced" | "Professional";
  pros: string[];
  cons: string[];
}

interface ApiResponse {
  recommendations: PartRecommendation[];
  car: { label: string; specs: string };
  mode: "general" | "specific";
}

const DIFFICULTY_COLORS: Record<string, string> = {
  "Bolt-on": "#30d158",
  Moderate: "#60A5FA",
  Advanced: "#fbbf24",
  Professional: "#ff453a",
};

function ShopContent() {
  const searchParams = useSearchParams();
  const prefilledMod = searchParams.get("mod");
  const prefilledCategory = searchParams.get("category") as ModCategory | null;
  const prefilledCarId = searchParams.get("carId");

  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState(prefilledCarId ?? "");
  const [loadingCars, setLoadingCars] = useState(true);

  const [scope, setScope] = useState<"general" | "specific">(
    prefilledMod ? "specific" : "general"
  );
  const [modCategory, setModCategory] = useState<ModCategory>(prefilledCategory ?? "engine");
  const [modName, setModName] = useState(prefilledMod ?? "");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copiedPart, setCopiedPart] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: carsData } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const list = (carsData ?? []) as Car[];
      setCars(list);
      // Honour pre-filled car id from query string if it belongs to the user
      if (prefilledCarId && list.some((c) => c.id === prefilledCarId)) {
        setSelectedCarId(prefilledCarId);
      } else {
        const primary = list.find((c) => c.is_primary) ?? list[0];
        if (primary) setSelectedCarId(primary.id);
      }
      setLoadingCars(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRecommendations() {
    if (!selectedCarId) return;
    if (scope === "specific" && !modName.trim()) {
      setError("Enter the mod you want to find parts for.");
      return;
    }
    setLoading(true);
    setError(null);
    haptic("light");

    try {
      const res = await fetch("/api/ai/parts-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: selectedCarId,
          ...(scope === "specific"
            ? { mod_name: modName.trim(), mod_category: modCategory }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to get recommendations");
      setData(json as ApiResponse);
      haptic("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copyPart(partNumber: string) {
    navigator.clipboard.writeText(partNumber);
    setCopiedPart(partNumber);
    haptic("light");
    setTimeout(() => setCopiedPart(null), 1500);
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center">
          <ShoppingBag size={18} className="text-[var(--color-accent-bright)]" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Parts Advisor</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Claude recommends specific parts for your car &mdash; with real brand names &amp; part numbers.
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 mt-6 space-y-5">
        {/* Scope toggle */}
        <div className="flex bg-[var(--color-bg-elevated)] rounded-xl p-1 gap-1 border border-[var(--color-border)]">
          {(
            [
              { v: "general" as const, label: "Next mods for my build" },
              { v: "specific" as const, label: "Find parts for a mod" },
            ]
          ).map((opt) => (
            <button
              key={opt.v}
              onClick={() => {
                setScope(opt.v);
                setData(null);
                setError(null);
              }}
              className={`flex-1 h-10 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                scope === opt.v
                  ? "bg-[var(--color-bg-card)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Car picker */}
        {cars.length > 0 ? (
          <Select
            label="Vehicle"
            value={selectedCarId}
            onChange={(e) => {
              setSelectedCarId(e.target.value);
              setData(null);
            }}
            options={cars.map((c) => ({
              value: c.id,
              label: `${c.year} ${c.make} ${c.model}${c.nickname ? ` — ${c.nickname}` : ""}`,
            }))}
          />
        ) : (
          !loadingCars && (
            <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">
              Add a car to your garage first to get recommendations.
            </div>
          )
        )}

        {/* Specific mod inputs */}
        {scope === "specific" && (
          <div className="space-y-3 animate-in">
            <Select
              label="Category"
              value={modCategory}
              onChange={(e) => setModCategory(e.target.value as ModCategory)}
              options={MOD_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <Autocomplete
              label="What mod are you looking for?"
              value={modName}
              onChange={setModName}
              suggestions={searchMods(modCategory, modName, 10)}
              placeholder="Coilovers, downpipe, big brake kit…"
              required
              hint="Type a mod name or pick from the suggestions"
              maxLength={120}
            />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.15)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </div>
        )}

        <button
          onClick={fetchRecommendations}
          disabled={!selectedCarId || loading || loadingCars}
          className="w-full h-12 rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-[0_8px_32px_rgba(59,130,246,0.25)]"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Asking Claude…
            </>
          ) : (
            <>
              <Sparkles size={15} />
              {data ? "Refresh recommendations" : "Get recommendations"}
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {data && (
        <div className="mt-6 space-y-4 animate-in">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold tracking-tight">
              Recommended for{" "}
              <span className="text-[var(--color-accent-bright)]">{data.car.label}</span>
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              {data.recommendations.length} picks
            </span>
          </div>

          {data.recommendations.length === 0 ? (
            <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] py-10 text-center">
              <Wrench size={22} className="mx-auto text-[var(--color-text-disabled)] mb-2" />
              <p className="text-sm text-[var(--color-text-muted)]">No recommendations returned. Try refreshing.</p>
            </div>
          ) : (
            data.recommendations.map((rec, i) => (
              <RecCard
                key={`${rec.brand}-${rec.product}-${i}`}
                rec={rec}
                index={i}
                copied={copiedPart === rec.partNumber}
                onCopy={() => rec.partNumber && copyPart(rec.partNumber)}
              />
            ))
          )}

          <p className="text-[10px] text-[var(--color-text-muted)] text-center pt-2">
            Recommendations are AI-generated guidance, not paid placements.
            Verify fitment with the manufacturer before buying.
          </p>
        </div>
      )}

      {!data && !loading && cars.length > 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] py-12 text-center">
          <Sparkles size={26} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-50" />
          <p className="text-sm font-bold text-[var(--color-text-secondary)]">
            Pick a vehicle and tap &ldquo;Get recommendations&rdquo;
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
            Claude reads your build and suggests specific parts that fit
          </p>
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-6 max-w-3xl mx-auto">
          <div className="skeleton h-48 rounded-3xl" />
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}

function RecCard({
  rec,
  index,
  copied,
  onCopy,
}: {
  rec: PartRecommendation;
  index: number;
  copied: boolean;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const diffColor = DIFFICULTY_COLORS[rec.difficulty] ?? "#888";

  return (
    <div
      className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden card-hover"
      style={{ animation: `fadeInUp 350ms cubic-bezier(0.16,1,0.3,1) both`, animationDelay: `${index * 60}ms` }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 cursor-pointer"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 font-black text-xs"
          style={{ background: "var(--color-accent-muted)", color: "var(--color-accent-bright)" }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-black text-white truncate">{rec.brand}</p>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)]">·</span>
            <p className="text-xs text-[var(--color-text-secondary)] truncate flex-1">{rec.product}</p>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[11px] font-bold tabular text-[var(--color-accent-bright)]">{rec.priceRange}</span>
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: `${diffColor}15`,
                color: diffColor,
                border: `1px solid ${diffColor}25`,
              }}
            >
              <Hammer size={8} />
              {rec.difficulty}
            </div>
          </div>
        </div>
        <ChevronDown
          size={15}
          className={`text-[var(--color-text-muted)] flex-shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-[var(--color-border)] pt-4 animate-in">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">{rec.fitsBecause}</p>

          {rec.partNumber && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Part #
              </p>
              <p className="text-xs font-mono font-bold text-white flex-1 truncate">
                {rec.partNumber}
              </p>
              <button
                type="button"
                onClick={onCopy}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[10px] font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] hover:text-white cursor-pointer transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={11} className="text-[var(--color-success)]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    Copy
                  </>
                )}
              </button>
            </div>
          )}

          {(rec.pros?.length > 0 || rec.cons?.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {rec.pros?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-success)] mb-1.5 flex items-center gap-1">
                    <ThumbsUp size={9} /> Pros
                  </p>
                  <ul className="space-y-1">
                    {rec.pros.map((p, i) => (
                      <li key={i} className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                        &middot; {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rec.cons?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-danger)] mb-1.5 flex items-center gap-1">
                    <ThumbsDown size={9} /> Cons
                  </p>
                  <ul className="space-y-1">
                    {rec.cons.map((c, i) => (
                      <li key={i} className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                        &middot; {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
