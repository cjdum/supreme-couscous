import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KARMA_BURN_THRESHOLD, KARMA_VALUES } from "@/lib/card-personality";

/**
 * GET /api/cards/karma
 *
 * Computes the user's karma from community actions:
 *  - Battles fought (+5 each)
 *  - Battles won (+3 each)
 *  - Forum posts (+5 each)
 *  - Ratings given (+2 each)
 *
 * Returns: { karma, threshold, can_burn }
 */

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Run all queries in parallel
  const [battlesResult, postsResult, ratingsResult] = await Promise.all([
    // Battles fought (as challenger or opponent)
    supabase
      .from("card_battles")
      .select("outcome, challenger_user_id", { count: "exact" })
      .or(`challenger_user_id.eq.${user.id},opponent_user_id.eq.${user.id}`),

    // Forum posts
    supabase
      .from("forum_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),

    // Ratings given (card_ratings where rater = user)
    supabase
      .from("card_ratings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  type BattleRow = { outcome: string; challenger_user_id: string };
  const battles = (battlesResult.data ?? []) as BattleRow[];
  const battlesFought = battles.length;
  const battlesWon = battles.filter(
    (b) => b.challenger_user_id === user.id
      ? b.outcome === "win" || b.outcome === "narrow_win"
      : b.outcome === "loss" || b.outcome === "narrow_loss",
  ).length;

  const forumPosts = postsResult.count ?? 0;
  const ratingsGiven = ratingsResult.count ?? 0;

  const karma =
    battlesFought * KARMA_VALUES.battle_fought +
    battlesWon    * KARMA_VALUES.battle_won +
    forumPosts    * KARMA_VALUES.forum_post +
    ratingsGiven  * KARMA_VALUES.rating_given;

  return NextResponse.json({
    karma,
    threshold: KARMA_BURN_THRESHOLD,
    can_burn: karma >= KARMA_BURN_THRESHOLD,
    breakdown: {
      battles_fought: battlesFought,
      battles_won: battlesWon,
      forum_posts: forumPosts,
      ratings_given: ratingsGiven,
    },
  });
}
