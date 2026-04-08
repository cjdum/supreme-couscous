import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signalWeight } from "@/lib/builder-score";

/**
 * POST /api/credibility/signal
 *
 * Submit a flag (unbelievable) or endorsement (credible) for a card.
 * Weight is proportional to Builder Score.
 * Sub-200 flags are capped to 0.25x per spec.
 *
 * Rate-limited: more than 10 flags in 24 hours triggers downweight and
 * review queue (enforced at caller / background job).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { card_id?: string; signal_type?: "flag" | "endorse"; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { card_id, signal_type, reason } = body;
  if (!card_id) return NextResponse.json({ error: "card_id required" }, { status: 400 });
  if (signal_type !== "flag" && signal_type !== "endorse") {
    return NextResponse.json({ error: "signal_type must be flag or endorse" }, { status: 400 });
  }

  // No self-signal
  const { data: cardRaw } = await supabase
    .from("pixel_cards")
    .select("id, user_id, authenticity_confidence")
    .eq("id", card_id)
    .maybeSingle();
  const card = cardRaw as { id: string; user_id: string; authenticity_confidence: number | null } | null;
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  if (card.user_id === user.id) {
    return NextResponse.json({ error: "Cannot signal your own card" }, { status: 403 });
  }

  // Throttle: more than 10 flags in 24h?
  if (signal_type === "flag") {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from("card_credibility_signals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("signal_type", "flag")
      .gte("created_at", since);
    if ((count ?? 0) >= 10) {
      return NextResponse.json({ error: "Flag rate limit reached. Try again later." }, { status: 429 });
    }
  }

  // Weight from Builder Score
  const { data: bsRaw } = await supabase
    .from("builder_scores")
    .select("composite_score")
    .eq("user_id", user.id)
    .maybeSingle();
  const bs = ((bsRaw as { composite_score: number } | null)?.composite_score) ?? 0;
  const weight = signalWeight(bs, signal_type);

  const { error: upErr } = await supabase.from("card_credibility_signals").upsert(
    {
      card_id,
      user_id: user.id,
      signal_type,
      weight,
      reason: (reason ?? "").slice(0, 500) || null,
    },
    { onConflict: "card_id,user_id,signal_type" },
  );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Recompute card authenticity_confidence from all signals
  const { data: all } = await supabase
    .from("card_credibility_signals")
    .select("signal_type, weight")
    .eq("card_id", card_id);
  type Sig = { signal_type: "flag" | "endorse"; weight: number };
  const sigs = (all ?? []) as Sig[];
  const flagW = sigs.filter((s) => s.signal_type === "flag").reduce((s, x) => s + x.weight, 0);
  const endW = sigs.filter((s) => s.signal_type === "endorse").reduce((s, x) => s + x.weight, 0);
  const base = card.authenticity_confidence ?? 60;
  const delta = Math.round((endW - flagW) * 3); // ±3% per weight
  const newConfidence = Math.max(0, Math.min(100, base + delta));

  await supabase
    .from("pixel_cards")
    .update({ authenticity_confidence: newConfidence })
    .eq("id", card_id);

  // Notify card owner
  await supabase
    .from("notifications")
    .insert({
      user_id: card.user_id,
      type: signal_type === "flag" ? "card_flagged" : "card_endorsed",
      payload: { card_id, user_id: user.id, weight, reason: reason ?? null },
    })
    .then(() => {}, () => {});

  return NextResponse.json({ ok: true, weight, authenticity_confidence: newConfidence });
}
