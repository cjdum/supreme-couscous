import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const { carId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: car } = await supabase
    .from("cars")
    .select("id")
    .eq("id", carId)
    .eq("user_id", user.id)
    .single();

  if (!car) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const timestamp = Date.now();
  const path = `${user.id}/${carId}_${timestamp}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("car-covers")
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("car-covers").getPublicUrl(path);

  await supabase
    .from("cars")
    .update({ cover_image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", carId);

  // Also save to car_photos gallery so this photo counts toward pixel-card
  // eligibility (≥1 real photo). Without this, the onboarding photo only
  // lives in cars.cover_image_url and the mint requirement reads zero.
  // Determine next position.
  const { count: existingCount } = await supabase
    .from("car_photos")
    .select("id", { count: "exact", head: true })
    .eq("car_id", carId);

  await supabase.from("car_photos").insert({
    car_id: carId,
    user_id: user.id,
    url: publicUrl,
    position: existingCount ?? 0,
    is_cover: (existingCount ?? 0) === 0,
  });

  return NextResponse.json({ url: publicUrl });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const { carId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: car } = await supabase
    .from("cars")
    .select("id")
    .eq("id", carId)
    .eq("user_id", user.id)
    .single();

  if (!car) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await supabase
    .from("cars")
    .update({ cover_image_url: null, updated_at: new Date().toISOString() })
    .eq("id", carId);

  return NextResponse.json({ ok: true });
}
