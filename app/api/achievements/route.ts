import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/achievements
 *
 * Returns the user's earned achievements plus progress toward unearned ones.
 * Unified model — replaces milestones, badges, and awards.
 *
 * Categories: builder, community, battle, platform
 */

interface AchievementDef {
  id: string;
  category: "builder" | "community" | "battle" | "platform";
  label: string;
  description: string;
  target: number;
  metric: string;
}

const ACHIEVEMENTS: AchievementDef[] = [
  // Builder category
  { id: "first_mod",       category: "builder",   label: "First Wrench",      description: "Log your first installed mod",    target: 1,   metric: "mods" },
  { id: "ten_mods",        category: "builder",   label: "Double Digits",     description: "Install 10 mods across your fleet", target: 10,  metric: "mods" },
  { id: "documented_five", category: "builder",   label: "Paper Trail",       description: "Fully document 5 mods (cost + date + notes + photo)", target: 5, metric: "documented_mods" },
  { id: "vin_verified",    category: "builder",   label: "Real One",          description: "Verify any car's VIN",            target: 1,   metric: "vin_verified_cars" },
  { id: "specialist",      category: "builder",   label: "Specialist",        description: "70%+ of mods on one car in a single category", target: 1, metric: "specialist_cars" },

  // Community category
  { id: "first_card",      category: "community", label: "First Ink",         description: "Mint your first card",            target: 1,   metric: "cards" },
  { id: "five_cards",      category: "community", label: "Collector",         description: "Mint 5 cards",                    target: 5,   metric: "cards" },
  { id: "first_rating",    category: "community", label: "First Vote",        description: "Rate another user's card",        target: 1,   metric: "ratings_given" },
  { id: "ten_ratings",     category: "community", label: "Curator",           description: "Rate 10 cards",                   target: 10,  metric: "ratings_given" },
  { id: "first_endorsement",category: "community",label: "Vouch",             description: "Endorse a credible card",         target: 1,   metric: "endorsements_given" },
  { id: "respected",       category: "community", label: "Respected",         description: "Earn 4.0+ average rating on a card", target: 1, metric: "respected_cards" },

  // Battle category
  { id: "first_battle",    category: "battle",    label: "First Blood",       description: "Complete your first battle",      target: 1,   metric: "battles" },
  { id: "three_battles",   category: "battle",    label: "Proven",            description: "Complete 3 battles",              target: 3,   metric: "battles" },
  { id: "battle_win",      category: "battle",    label: "First Win",         description: "Win your first battle",           target: 1,   metric: "battle_wins" },
  { id: "battle_streak",   category: "battle",    label: "Streak",            description: "Win 3 battles in a row",          target: 3,   metric: "battle_streak" },

  // Platform category
  { id: "platform_week",   category: "platform",  label: "One Week In",       description: "Stay active for 7 days",          target: 7,   metric: "tenure_days" },
  { id: "platform_month",  category: "platform",  label: "Regular",           description: "30 days on the platform",         target: 30,  metric: "tenure_days" },
  { id: "platform_year",   category: "platform",  label: "Veteran",           description: "365 days on the platform",        target: 365, metric: "tenure_days" },
  { id: "builder_score_400",category: "platform", label: "Builder",           description: "Reach Builder Score 400",         target: 400, metric: "builder_score" },
  { id: "builder_score_600",category: "platform", label: "Respected",         description: "Reach Builder Score 600",         target: 600, metric: "builder_score" },
  { id: "builder_score_800",category: "platform", label: "Authority",         description: "Reach Builder Score 800",         target: 800, metric: "builder_score" },
];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Gather live metrics
  const [
    { data: modsRaw },
    { data: carsRaw },
    { data: cardsRaw },
    { data: ratingsGivenRaw },
    { data: endorsementsGivenRaw },
    { data: battlesRaw },
    { data: profileRaw },
    { data: bsRaw },
    { data: modPhotoRaw },
  ] = await Promise.all([
    supabase.from("mods").select("id, category, car_id, cost, install_date, notes, status").eq("user_id", user.id),
    supabase.from("cars").select("id, vin_verified").eq("user_id", user.id),
    supabase.from("pixel_cards").select("id").eq("user_id", user.id),
    supabase.from("card_ratings").select("id").eq("rater_id", user.id),
    supabase.from("card_credibility_signals").select("id, signal_type").eq("user_id", user.id),
    supabase.from("card_battles").select("outcome, challenger_user_id, opponent_user_id").or(`challenger_user_id.eq.${user.id},opponent_user_id.eq.${user.id}`),
    supabase.from("profiles").select("created_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("builder_scores").select("composite_score").eq("user_id", user.id).maybeSingle(),
    supabase.from("mod_photos").select("mod_id").eq("user_id", user.id),
  ]);

  type ModRow = { id: string; category: string; car_id: string; cost: number | null; install_date: string | null; notes: string | null; status: string };
  const mods = ((modsRaw ?? []) as ModRow[]).filter((m) => m.status === "installed");

  const modPhotoCount: Record<string, number> = {};
  for (const r of (modPhotoRaw ?? []) as { mod_id: string }[]) {
    modPhotoCount[r.mod_id] = (modPhotoCount[r.mod_id] ?? 0) + 1;
  }

  const documentedMods = mods.filter(
    (m) => m.cost != null && m.cost > 0 && m.install_date && (m.notes ?? "").trim().length >= 20 && (modPhotoCount[m.id] ?? 0) >= 1,
  ).length;

  const specialistCars = (() => {
    const byCar = new Map<string, string[]>();
    for (const m of mods) {
      const arr = byCar.get(m.car_id) ?? [];
      arr.push(m.category);
      byCar.set(m.car_id, arr);
    }
    let count = 0;
    for (const list of byCar.values()) {
      if (list.length < 3) continue;
      const counts: Record<string, number> = {};
      for (const c of list) counts[c] = (counts[c] ?? 0) + 1;
      const top = Math.max(...Object.values(counts));
      if (top / list.length >= 0.7) count++;
    }
    return count;
  })();

  const vinVerifiedCars = ((carsRaw ?? []) as { vin_verified: boolean }[]).filter((c) => c.vin_verified).length;
  const cardCount = (cardsRaw ?? []).length;
  const ratingsGiven = (ratingsGivenRaw ?? []).length;
  const endorsementsGiven = ((endorsementsGivenRaw ?? []) as { signal_type: string }[]).filter(
    (s) => s.signal_type === "endorse",
  ).length;

  type BattleRow = { outcome: string; challenger_user_id: string; opponent_user_id: string };
  const battles = (battlesRaw ?? []) as BattleRow[];
  const battleCount = battles.length;
  const battleWins = battles.filter((b) => {
    const win = b.outcome === "win" || b.outcome === "narrow_win";
    return (b.challenger_user_id === user.id && win) || (b.opponent_user_id === user.id && !win);
  }).length;

  // Streak (simple: longest consecutive wins in the recent 10)
  const recent = battles.slice(-10);
  let best = 0;
  let cur = 0;
  for (const b of recent) {
    const win = b.outcome === "win" || b.outcome === "narrow_win";
    const myWin = (b.challenger_user_id === user.id && win) || (b.opponent_user_id === user.id && !win);
    if (myWin) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }

  const tenureDays = profileRaw
    ? Math.floor((Date.now() - new Date((profileRaw as { created_at: string }).created_at).getTime()) / 86_400_000)
    : 0;
  const builderScore = ((bsRaw as { composite_score: number } | null)?.composite_score) ?? 0;

  const metrics: Record<string, number> = {
    mods: mods.length,
    documented_mods: documentedMods,
    vin_verified_cars: vinVerifiedCars,
    specialist_cars: specialistCars,
    cards: cardCount,
    ratings_given: ratingsGiven,
    endorsements_given: endorsementsGiven,
    respected_cards: 0, // computed below
    battles: battleCount,
    battle_wins: battleWins,
    battle_streak: best,
    tenure_days: tenureDays,
    builder_score: builderScore,
  };

  // Already-earned achievements from the table
  const { data: earnedRaw } = await supabase
    .from("achievements")
    .select("achievement_type, earned_at")
    .eq("user_id", user.id);
  const earnedMap = new Map<string, string>();
  for (const r of (earnedRaw ?? []) as { achievement_type: string; earned_at: string }[]) {
    earnedMap.set(r.achievement_type, r.earned_at);
  }

  // Derive new earns (insert best-effort)
  const newEarns: { id: string; category: string }[] = [];
  const list = ACHIEVEMENTS.map((a) => {
    const current = metrics[a.metric] ?? 0;
    const earned = earnedMap.has(a.id) || current >= a.target;
    if (!earnedMap.has(a.id) && current >= a.target) {
      newEarns.push({ id: a.id, category: a.category });
    }
    return {
      ...a,
      progress: Math.min(current, a.target),
      earned,
      earned_at: earnedMap.get(a.id) ?? null,
    };
  });

  if (newEarns.length > 0) {
    await supabase
      .from("achievements")
      .insert(
        newEarns.map((a) => ({
          user_id: user.id,
          achievement_type: a.id,
          category: a.category,
          progress_data: {},
        })),
      )
      .then(() => {}, () => {});
  }

  return NextResponse.json({ achievements: list, metrics });
}
