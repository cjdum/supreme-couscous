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

  // Verify car belongs to user
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

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${carId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("car-covers")
    .upload(path, file, { upsert: true, contentType: file.type });

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

  return NextResponse.json({ url: publicUrl });
}
