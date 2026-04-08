/**
 * Vehicle stock spec lookup — the source of truth for baseline performance
 * numbers when an AI generates a card. Wraps the vehicle_stock_specs table.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehicleStockSpec } from "@/lib/supabase/types";

export interface StockSpecs {
  hp: number | null;
  torque: number | null;
  zero_to_sixty: number | null;
  top_speed: number | null;
  weight: number | null;
  matched: boolean;
  /** True if we found an exact year/make/model/trim row. False if we fell back to closest. */
  exact: boolean;
  /** The row that matched (or null). */
  source: VehicleStockSpec | null;
}

/**
 * Look up stock specs for a vehicle, using progressively looser matching.
 * Returns matched=false if the vehicle is not in the table so the AI can
 * acknowledge uncertainty and give a conservative estimate.
 */
export async function lookupStockSpecs(
  supabase: SupabaseClient,
  year: number,
  make: string,
  model: string,
  trim?: string | null,
): Promise<StockSpecs> {
  const empty: StockSpecs = {
    hp: null,
    torque: null,
    zero_to_sixty: null,
    top_speed: null,
    weight: null,
    matched: false,
    exact: false,
    source: null,
  };

  // 1. Exact year + make + model + trim
  if (trim && trim.trim()) {
    const { data } = await supabase
      .from("vehicle_stock_specs")
      .select("*")
      .eq("year", year)
      .ilike("make", make)
      .ilike("model", model)
      .ilike("trim", trim)
      .maybeSingle();
    if (data) {
      const row = data as VehicleStockSpec;
      return {
        hp: row.hp, torque: row.torque, zero_to_sixty: row.zero_to_sixty,
        top_speed: row.top_speed, weight: row.weight, matched: true, exact: true, source: row,
      };
    }
  }

  // 2. Exact year + make + model (any trim)
  const { data: mmy } = await supabase
    .from("vehicle_stock_specs")
    .select("*")
    .eq("year", year)
    .ilike("make", make)
    .ilike("model", model)
    .limit(1)
    .maybeSingle();
  if (mmy) {
    const row = mmy as VehicleStockSpec;
    return {
      hp: row.hp, torque: row.torque, zero_to_sixty: row.zero_to_sixty,
      top_speed: row.top_speed, weight: row.weight, matched: true, exact: false, source: row,
    };
  }

  // 3. Closest year for the same make/model
  const { data: any } = await supabase
    .from("vehicle_stock_specs")
    .select("*")
    .ilike("make", make)
    .ilike("model", model)
    .order("year", { ascending: false })
    .limit(20);
  const rows = (any ?? []) as VehicleStockSpec[];
  if (rows.length > 0) {
    const closest = rows.sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0];
    return {
      hp: closest.hp, torque: closest.torque, zero_to_sixty: closest.zero_to_sixty,
      top_speed: closest.top_speed, weight: closest.weight,
      matched: true, exact: false, source: closest,
    };
  }

  return empty;
}

/**
 * Realistic HP estimate derived from stock HP + mod deltas.
 * Conservative — doesn't claim bolt-ons double HP.
 */
export function estimateModdedHp(stockHp: number | null, mods: { category: string; name: string }[]): number | null {
  if (stockHp == null) return null;

  const text = mods.map((m) => `${m.category} ${m.name}`.toLowerCase()).join(" | ");

  let pct = 0;
  const hit = (re: RegExp, p: number) => { if (re.test(text)) pct += p; };

  // Intake/exhaust/tune = bolt-on gains
  hit(/(intake|cold\s*air|airbox)/, 0.02);
  hit(/(exhaust|downpipe|headers?)/, 0.03);
  hit(/(tune|ecu|stage\s*[12])/, 0.06);
  // Stage 2+ tune
  hit(/stage\s*2/, 0.04);
  hit(/stage\s*3/, 0.08);
  // Forced induction
  hit(/(supercharger|blower)/, 0.30);
  hit(/(turbo(?!\s*back))/, 0.25);
  hit(/twin[\s-]?turbo/, 0.12); // on top of the above
  // Intercoolers/fueling
  hit(/intercooler/, 0.03);
  hit(/(fuel\s*pump|injectors?|e85|meth)/, 0.04);
  // Internals
  hit(/(forged|pistons?|rods?|stroker|cams?)/, 0.05);
  // Nitrous
  hit(/nitrous/, 0.12);

  // Cap total at +80% for a street build
  pct = Math.min(pct, 0.80);

  return Math.round(stockHp * (1 + pct));
}

/** Torque scales similarly to HP for most builds. */
export function estimateModdedTorque(stockTorque: number | null, deltaPct: number): number | null {
  if (stockTorque == null) return null;
  return Math.round(stockTorque * (1 + deltaPct));
}

/** 0-60 shaves roughly 1s per 100hp gained. Conservative. */
export function estimateModdedZeroToSixty(stockZeroToSixty: number | null, hpDelta: number | null): number | null {
  if (stockZeroToSixty == null || hpDelta == null || hpDelta === 0) return stockZeroToSixty;
  const seconds = Math.max(1.8, stockZeroToSixty - Math.abs(hpDelta) / 100);
  return Math.round(seconds * 10) / 10;
}

/** Top speed rises slightly — not a direct HP mapping. */
export function estimateModdedTopSpeed(stockTopSpeed: number | null, hpDelta: number | null): number | null {
  if (stockTopSpeed == null) return null;
  if (hpDelta == null || hpDelta <= 0) return stockTopSpeed;
  const gain = Math.min(30, Math.round(hpDelta / 20));
  return stockTopSpeed + gain;
}
