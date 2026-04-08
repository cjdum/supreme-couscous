import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { raterWeight } from "@/lib/builder-score";

/**
 * POST /api/ratings/submit
 *
 * Submit or update a community rating on another user's card.
 * Four dimensions (1-5): cleanliness, creativity, execution, presence.
 * Weight is the rater's Builder Score tier multiplier (locked at time of
 * rating to avoid retroactive inflation).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    card_id?: string;
    cleanliness?: number;
    creativity?: number;
    execution?: number;
    presence?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { card_id, cleanliness, creativity, execution, presence } = body;
  if (!card_id) return NextResponse.json({ error: "card_id required" }, { status: 400 });
  const dims = [cleanliness, creativity, execution, presence];
  for (const d of dims) {
    if (typeof d !== "number" || d < 1 || d > 5) {
      return NextResponse.json({ error: "Each dimension must be 1-5" }, { status: 400 });
    }
  }

  // No self-rating
  const { data: cardRaw } = await supabase
    .from("pixel_cards")
    .select("id, user_id")
    .eq("id", card_id)
    .maybeSingle();
  const card = cardRaw as { id: string; user_id: string } | null;
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  if (card.user_id === user.id) {
    return NextResponse.json({ error: "Cannot rate your own card" }, { status: 403 });
  }

  // Rater's current Builder Score (for weight)
  const { data: bsRaw } = await supabase
    .from("builder_scores")
    .select("composite_score")
    .eq("user_id", user.id)
    .maybeSingle();
  const bs = ((bsRaw as { composite_score: number } | null)?.composite_score) ?? 0;
  const weight = raterWeight(bs);

  // Unweighted average of the four dimensions
  const avg = ((cleanliness! + creativity! + execution! + presence!) / 4);
  const weighted = Math.round(avg * weight * 100) / 100;

  const { error: upErr } = await supabase.from("card_ratings").upsert(
    {
      card_id,
      rater_id: user.id,
      rater_builder_score_at_time: bs,
      cleanliness: cleanliness!,
      creativity: creativity!,
      execution: execution!,
      presence: presence!,
      weighted_composite: weighted,
    },
    { onConflict: "card_id,rater_id" },
  );

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Notify card owner (best-effort)
  await supabase.from("notifications").insert({
    user_id: card.user_id,
    type: "card_rated",
    payload: { card_id, rater_id: user.id, weighted },
  }).then(() => {}, () => {});

  return NextResponse.json({ ok: true, weighted });
}
