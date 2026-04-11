import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getBotById } from "@/lib/bot-cards";

/**
 * POST /api/battles/bot
 *
 * Challenge a pre-defined bot opponent.
 * Body: { cardId: string, botId: string, outcome?: "win" | "loss", roundResults?: unknown[] }
 *
 * If `outcome` is provided, it is used directly (client-side Three-Round Duel result)
 * and server-side score computation is skipped.
 *
 * Without `outcome`, battle scoring is computed server-side:
 *   HP contribution       (0–40 pts)
 *   Build score           (0–30 pts)
 *   0-60 speed inverted   (0–20 pts, lower is better)
 *   Torque                (0–10 pts)
 *   Random variance       ±15%
 *
 * Returns: { winner, userScore, botScore, outcome, margin, newRecord }
 */

const BOT_RATE_LIMIT = { limit: 20, windowSec: 60 };

function scoreCard(
  hp: number,
  buildScore: number,
  zeroToSixty: number,
  torque: number,
): number {
  const hpPts    = Math.min(40, (hp / 1000) * 40);
  const scorePts = Math.min(30, (buildScore / 1000) * 30);
  const speedPts = Math.max(0, Math.min(20, ((12 - zeroToSixty) / 10) * 20));
  const torquePts = Math.min(10, (torque / 1000) * 10);
  return hpPts + scorePts + speedPts + torquePts;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`bot-battle:${user.id}`, BOT_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: "Slow down" }, { status: 429 });

  let body: { cardId?: string; botId?: string; outcome?: "win" | "loss"; roundResults?: unknown[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { cardId, botId, outcome: clientOutcome } = body;
  if (!cardId || !botId)
    return NextResponse.json({ error: "cardId and botId are required" }, { status: 400 });

  // Load user's card
  const { data: userCard } = await supabase
    .from("pixel_cards")
    .select("id, user_id, hp, car_snapshot, battle_record")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!userCard) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  // Load bot
  const bot = getBotById(botId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  type Snap = { build_score?: number | null; torque?: number | null; zero_to_sixty?: number | null };

  // Score user card
  const snap = (userCard.car_snapshot ?? {}) as Snap;
  const userHp         = userCard.hp ?? 150;
  const userBuildScore = snap.build_score ?? 0;
  const userZeroSixty  = snap.zero_to_sixty ?? 8;
  const userTorque     = snap.torque ?? 150;

  const baseUser = scoreCard(userHp, userBuildScore, userZeroSixty, userTorque);
  const baseBot  = scoreCard(bot.hp, bot.buildScore, bot.zeroToSixty, bot.torque);

  // ±15% random variance
  const randUser = 1 + (Math.random() - 0.5) * 0.30;
  const randBot  = 1 + (Math.random() - 0.5) * 0.30;

  const finalUser = Math.round((baseUser * randUser) * 10) / 10;
  const finalBot  = Math.round((baseBot  * randBot)  * 10) / 10;

  // If the client sent a resolved outcome (Three-Round Duel), use it directly.
  // Otherwise compute server-side for integrity.
  let userWins: boolean;
  let outcome: "win" | "loss" | "narrow_win" | "narrow_loss";

  const margin = Math.abs(finalUser - finalBot) / Math.max(finalUser, finalBot, 1);

  if (clientOutcome === "win" || clientOutcome === "loss") {
    userWins = clientOutcome === "win";
    outcome  = clientOutcome;
  } else {
    userWins = finalUser >= finalBot;
    if (userWins) {
      outcome = margin < 0.08 ? "narrow_win" : "win";
    } else {
      outcome = margin < 0.08 ? "narrow_loss" : "loss";
    }
  }

  // Save to card_battles
  await supabase.from("card_battles").insert({
    challenger_card_id: cardId,
    opponent_card_id: botId,          // bot id string (no FK)
    challenger_user_id: user.id,
    opponent_user_id: null,           // no user for bots
    outcome,
    score_breakdown: {
      challenger: finalUser,
      opponent:   finalBot,
      bot_id:     botId,
    },
  });

  // Update user card battle_record
  const record = (userCard.battle_record as { wins: number; losses: number } | null) ?? { wins: 0, losses: 0 };
  const newWins   = record.wins   + (userWins ? 1 : 0);
  const newLosses = record.losses + (userWins ? 0 : 1);

  await supabase.from("pixel_cards").update({
    battle_record: { wins: newWins, losses: newLosses },
    last_battle_at: new Date().toISOString(),
  }).eq("id", cardId);

  // Win bonus: each win permanently boosts the card's HP by a small amount
  if (outcome === "win") {
    const wins = (record.wins ?? 0) + 1;
    // Milestone bonuses at 1, 5, 10, 25 wins
    const bonusHp = wins === 1 ? 5 : wins === 5 ? 10 : wins === 10 ? 15 : wins === 25 ? 25 : 2;
    // Use a safe increment via manual fetch+update
    const { data: currentCard } = await supabase
      .from("pixel_cards")
      .select("hp")
      .eq("id", cardId)
      .single();
    if (currentCard?.hp != null) {
      await supabase
        .from("pixel_cards")
        .update({ hp: Math.min(currentCard.hp + bonusHp, 9999) })
        .eq("id", cardId);
    }
  }

  return NextResponse.json({
    winner:    userWins ? "user" : "bot",
    userScore: finalUser,
    botScore:  finalBot,
    outcome,
    margin:    Math.round(margin * 1000) / 1000,
    newRecord: { wins: newWins, losses: newLosses },
  });
}
