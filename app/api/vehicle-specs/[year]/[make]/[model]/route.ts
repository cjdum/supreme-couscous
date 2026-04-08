import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupStockSpecs } from "@/lib/vehicle-specs";

/**
 * GET /api/vehicle-specs/[year]/[make]/[model]?trim=...
 *
 * Looks up the stock specs for a vehicle. Returns matched=false when the
 * exact vehicle isn't in our lookup table.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ year: string; make: string; model: string }> },
) {
  const { year, make, model } = await ctx.params;
  const url = new URL(req.url);
  const trim = url.searchParams.get("trim") ?? undefined;

  const yearNum = parseInt(year, 10);
  if (Number.isNaN(yearNum)) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 });
  }

  const supabase = await createClient();
  const stock = await lookupStockSpecs(supabase, yearNum, decodeURIComponent(make), decodeURIComponent(model), trim);
  return NextResponse.json(stock);
}
