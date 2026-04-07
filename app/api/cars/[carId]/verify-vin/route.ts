import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/cars/[carId]/verify-vin
 *
 * Hits the NHTSA decode API to validate the car's stored VIN and updates
 * the car record with authoritative spec data. Sets vin_verified=true on
 * success. Idempotent — safe to call multiple times.
 */

interface Params {
  params: Promise<{ carId: string }>;
}

interface NHTSAResult {
  Variable: string;
  Value: string | null;
}

function parseNHTSA(results: NHTSAResult[], variable: string): string | null {
  const found = results.find((r) => r.Variable === variable);
  return found?.Value && found.Value.trim().length > 0 ? found.Value.trim() : null;
}

export async function POST(_req: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load the car and confirm ownership + VIN presence
  const { data: carRaw } = await supabase
    .from("cars")
    .select("id, user_id, vin, vin_verified, make, model, year, trim, engine_size")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();

  const car = carRaw as {
    id: string;
    user_id: string;
    vin: string | null;
    vin_verified: boolean;
    make: string;
    model: string;
    year: number;
    trim: string | null;
    engine_size: string | null;
  } | null;

  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });
  if (!car.vin || car.vin.trim().length !== 17) {
    return NextResponse.json({ error: "No valid VIN stored on this car" }, { status: 400 });
  }

  // Already verified — return current data without re-hitting NHTSA
  if (car.vin_verified) {
    return NextResponse.json({
      vin_verified: true,
      make: car.make,
      model: car.model,
      year: car.year,
      trim: car.trim,
      engine_size: car.engine_size,
    });
  }

  // ── NHTSA decode ────────────────────────────────────────────────────────────
  let parsedMake: string | null = null;
  let parsedModel: string | null = null;
  let parsedYear: number | null = null;
  let parsedTrim: string | null = null;
  let parsedEngineSize: string | null = null;

  try {
    const nhtsa = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(car.vin)}?format=json`,
      { next: { revalidate: 0 } }
    );
    if (!nhtsa.ok) throw new Error(`NHTSA returned HTTP ${nhtsa.status}`);
    const json = await nhtsa.json() as { Results?: NHTSAResult[]; Count?: number };

    const results: NHTSAResult[] = json.Results ?? [];

    parsedMake  = parseNHTSA(results, "Make");
    parsedModel = parseNHTSA(results, "Model");
    const yearStr = parseNHTSA(results, "Model Year");
    parsedYear  = yearStr ? parseInt(yearStr, 10) : null;
    parsedTrim  = parseNHTSA(results, "Trim");

    const displacementL   = parseNHTSA(results, "Displacement (L)");
    const cylinders       = parseNHTSA(results, "Engine Number of Cylinders");

    if (displacementL) {
      const liters = parseFloat(displacementL).toFixed(1);
      parsedEngineSize = cylinders
        ? `${liters}L ${cylinders}-cyl`
        : `${liters}L`;
    }

    // NHTSA validation: model year must parse and make must exist
    if (!parsedMake || !parsedYear || isNaN(parsedYear)) {
      return NextResponse.json(
        { error: "VIN not recognized — check that the VIN is correct and try again." },
        { status: 422 }
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("VIN not recognized")) throw err;
    console.error("[verify-vin] NHTSA fetch failed:", err);
    return NextResponse.json(
      { error: "Could not reach the NHTSA database. Try again in a moment." },
      { status: 502 }
    );
  }

  // ── Update car record ────────────────────────────────────────────────────────
  const updates: Record<string, unknown> = {
    vin_verified: true,
    updated_at: new Date().toISOString(),
  };
  if (parsedMake)        updates.make         = parsedMake;
  if (parsedModel)       updates.model        = parsedModel;
  if (parsedYear)        updates.year         = parsedYear;
  if (parsedTrim)        updates.trim         = parsedTrim;
  if (parsedEngineSize)  updates.engine_size  = parsedEngineSize;

  const { error: updErr } = await supabase
    .from("cars")
    .update(updates)
    .eq("id", carId)
    .eq("user_id", user.id);

  if (updErr) {
    console.error("[verify-vin] db update failed:", updErr.message);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  console.log(`[verify-vin] verified car=${carId} make=${parsedMake} year=${parsedYear}`);

  return NextResponse.json({
    vin_verified: true,
    make: parsedMake ?? car.make,
    model: parsedModel ?? car.model,
    year: parsedYear ?? car.year,
    trim: parsedTrim ?? car.trim,
    engine_size: parsedEngineSize ?? car.engine_size,
  });
}
