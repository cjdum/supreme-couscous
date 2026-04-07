import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sanitize } from "@/lib/utils";

const updateSchema = z.object({
  display_name: z.string().max(60).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = updateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if ("display_name" in result.data) {
    updates.display_name = result.data.display_name ? sanitize(result.data.display_name) : null;
  }
  if ("bio" in result.data) {
    updates.bio = result.data.bio ? sanitize(result.data.bio) : null;
  }
  if ("avatar_url" in result.data) {
    updates.avatar_url = result.data.avatar_url ?? null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) {
    console.error("[user/profile] update error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
