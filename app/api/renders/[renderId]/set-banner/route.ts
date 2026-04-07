import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/renders/[renderId]/set-banner
 *
 * Marks a render as the active banner for its car. Sets `renders.is_banner=true`
 * on this row, false on all other renders for the same car, and copies the
 * image_url into `cars.cover_image_url` so the rest of the app picks it up.
 *
 * The visualizer route uses `image_descriptor` from the original photo, so
 * promoting a render to banner does NOT cause future renders to drift — the
 * source-of-truth descriptor stays attached to the original upload.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ renderId: string }> }
) {
  const { renderId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the render and verify ownership
  const { data: renderRaw, error: rErr } = await supabase
    .from("renders")
    .select("id, car_id, user_id, image_url")
    .eq("id", renderId)
    .maybeSingle();
  if (rErr || !renderRaw) {
    return NextResponse.json({ error: "Render not found" }, { status: 404 });
  }
  const render = renderRaw as {
    id: string;
    car_id: string;
    user_id: string;
    image_url: string | null;
  };
  if (render.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!render.image_url) {
    return NextResponse.json({ error: "Render has no image" }, { status: 400 });
  }

  // Clear is_banner on every other render for this car…
  const { error: clearErr } = await supabase
    .from("renders")
    .update({ is_banner: false })
    .eq("car_id", render.car_id)
    .neq("id", renderId);
  if (clearErr) {
    console.error("[set-banner] clear error:", clearErr.message);
  }

  // …then mark this one as the banner
  const { error: setErr } = await supabase
    .from("renders")
    .update({ is_banner: true })
    .eq("id", renderId);
  if (setErr) {
    return NextResponse.json({ error: setErr.message }, { status: 500 });
  }

  // Mirror the image_url onto the car so existing UI keeps working
  const { error: carErr } = await supabase
    .from("cars")
    .update({
      cover_image_url: render.image_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", render.car_id)
    .eq("user_id", user.id);
  if (carErr) {
    return NextResponse.json({ error: carErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cover_image_url: render.image_url });
}
