import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/user/avatar
 * Upload an avatar image. Stores in the existing `car-covers` bucket under
 * `avatars/{userId}/{timestamp}.{ext}` so we don't need a new bucket.
 *
 * Body: multipart/form-data with field "photo"
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;

  if (!file || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "No valid image" }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 4MB" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  // First folder segment MUST be the user id so the storage RLS policy
  // ("auth.uid()::text = (storage.foldername(name))[1]") accepts the upload.
  const fileName = `${user.id}/avatars/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("car-covers")
    .upload(fileName, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[user/avatar] upload error:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("car-covers").getPublicUrl(fileName);

  const { error: dbError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (dbError) {
    console.error("[user/avatar] db update error:", dbError.message);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ avatar_url: publicUrl }, { status: 201 });
}
