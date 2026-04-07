import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ carId: string }>;
}

async function verifyOwner(supabase: Awaited<ReturnType<typeof createClient>>, carId: string, userId: string) {
  const { data } = await supabase.from("cars").select("id").eq("id", carId).eq("user_id", userId).maybeSingle();
  return !!data;
}

// GET /api/cars/[carId]/photos
export async function GET(_req: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await verifyOwner(supabase, carId, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: photos } = await supabase
    .from("car_photos")
    .select("id, url, position, is_cover, created_at")
    .eq("car_id", carId)
    .order("position", { ascending: true });

  return NextResponse.json({ photos: photos ?? [] });
}

// POST /api/cars/[carId]/photos — upload new photo
export async function POST(request: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await verifyOwner(supabase, carId, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;

  if (!file || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "No valid image" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 8MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${user.id}/${carId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("car-covers")
    .upload(fileName, file, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from("car-covers").getPublicUrl(fileName);

  // Get current max position
  const { data: existing } = await supabase
    .from("car_photos")
    .select("position")
    .eq("car_id", carId)
    .order("position", { ascending: false })
    .limit(1);

  const isFirstPhoto = !existing || existing.length === 0;
  const maxPosition = existing?.[0]?.position ?? 0;

  const { data: photo, error: dbError } = await supabase
    .from("car_photos")
    .insert({
      car_id: carId,
      user_id: user.id,
      url: publicUrl,
      position: maxPosition + 1,
      is_cover: isFirstPhoto,
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // First photo becomes the cover
  if (isFirstPhoto) {
    await supabase.from("cars").update({ cover_image_url: publicUrl }).eq("id", carId);
  }

  return NextResponse.json({ photo, url: publicUrl }, { status: 201 });
}

// PATCH /api/cars/[carId]/photos — set cover photo
export async function PATCH(request: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await verifyOwner(supabase, carId, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { action: string; photo_id?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.action === "set_cover" && body.photo_id) {
    await supabase.from("car_photos").update({ is_cover: false }).eq("car_id", carId);
    const { data: photo } = await supabase
      .from("car_photos")
      .update({ is_cover: true })
      .eq("id", body.photo_id)
      .select("url")
      .single();

    if (photo) {
      await supabase.from("cars").update({ cover_image_url: photo.url }).eq("id", carId);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// DELETE /api/cars/[carId]/photos?photoId=xxx
export async function DELETE(request: Request, { params }: Params) {
  const { carId } = await params;
  const { searchParams } = new URL(request.url);
  const photoId = searchParams.get("photoId");
  if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: photo } = await supabase
    .from("car_photos")
    .select("id, url, is_cover")
    .eq("id", photoId)
    .eq("car_id", carId)
    .maybeSingle();

  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  // Remove from storage
  const pathMatch = photo.url.match(/car-covers\/(.+)$/);
  if (pathMatch) await supabase.storage.from("car-covers").remove([pathMatch[1]]);

  await supabase.from("car_photos").delete().eq("id", photoId);

  // Promote next photo to cover if deleted was cover
  if (photo.is_cover) {
    const { data: next } = await supabase
      .from("car_photos")
      .select("id, url")
      .eq("car_id", carId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      await supabase.from("car_photos").update({ is_cover: true }).eq("id", next.id);
      await supabase.from("cars").update({ cover_image_url: next.url }).eq("id", carId);
    } else {
      await supabase.from("cars").update({ cover_image_url: null }).eq("id", carId);
    }
  }

  return NextResponse.json({ success: true });
}
