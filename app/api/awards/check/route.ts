import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateAwards, type AwardCheckInput } from "@/lib/awards";

/**
 * POST /api/awards/check
 *
 * Feature 16 — runs every award rule against the current user's data and
 * inserts any newly-unlocked rows into `user_awards`. Returns the freshly
 * unlocked award IDs so the client can fire the Balatro-style reveal.
 *
 * This is the *one* surface the client calls after meaningful state changes
 * (mod added, render generated, build made public). Cheap, idempotent.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Pull everything we need to score awards in one shot ──
  const [carsRes, modsRes, rendersRes, postsRes] = await Promise.all([
    supabase.from("cars").select("id, horsepower, stock_horsepower, is_public").eq("user_id", user.id),
    supabase
      .from("mods")
      .select("category, status, cost, install_date, created_at")
      .eq("user_id", user.id),
    supabase.from("renders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const cars = (carsRes.data ?? []) as {
    id: string;
    horsepower: number | null;
    stock_horsepower: number | null;
    is_public: boolean | null;
  }[];

  const mods = (modsRes.data ?? []) as {
    category: string;
    status: string;
    cost: number | null;
    install_date: string | null;
    created_at: string;
  }[];

  const installed = mods.filter((m) => m.status === "installed");
  const totalInvested = installed.reduce((s, m) => s + (m.cost ?? 0), 0);
  const topModCost = installed.reduce((max, m) => Math.max(max, m.cost ?? 0), 0);
  const uniqueCategoryCount = new Set(installed.map((m) => m.category)).size;
  const hpGain = cars.reduce((sum, c) => {
    if (c.horsepower && c.stock_horsepower) {
      return sum + Math.max(0, c.horsepower - c.stock_horsepower);
    }
    return sum;
  }, 0);

  // Night-owl check: any mod logged between midnight and 5am local-ish (UTC)
  const isNightOwl = mods.some((m) => {
    const date = m.install_date ?? m.created_at;
    if (!date) return false;
    const hr = new Date(date).getUTCHours();
    return hr >= 0 && hr < 5;
  });

  // Approximate "build score" using mod-count weighting (real calc is in lib/build-score)
  // Awards can be a coarse signal; the exact threshold isn't critical here.
  const buildScore =
    installed.length * 8 +
    cars.length * 20 +
    Math.min(200, Math.floor(totalInvested / 100));

  const renderCount = rendersRes.count ?? 0;
  const publicCarCount = cars.filter((c) => c.is_public).length;

  const input: AwardCheckInput = {
    carCount: cars.length,
    modCount: mods.length,
    installedModCount: installed.length,
    totalInvested,
    topModCost,
    buildScore,
    hasRender: renderCount > 0,
    renderCount,
    publicCarCount,
    forumPostCount: postsRes.count ?? 0,
    carPhotoCount: 0, // not currently used
    uniqueCategoryCount,
    hpGain,
    isNightOwl,
  };

  const qualifiedIds = evaluateAwards(input);

  // Figure out which are new
  const { data: existingRaw } = await supabase
    .from("user_awards")
    .select("award_id")
    .eq("user_id", user.id);
  const existing = new Set(((existingRaw ?? []) as { award_id: string }[]).map((r) => r.award_id));

  const newIds = qualifiedIds.filter((id) => !existing.has(id));

  if (newIds.length > 0) {
    const inserts = newIds.map((award_id) => ({ user_id: user.id, award_id }));
    const { error: insErr } = await supabase.from("user_awards").insert(inserts);
    if (insErr) {
      console.error("[awards] insert failed:", insErr.message);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    unlocked: newIds,
    total: qualifiedIds.length,
  });
}
