import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications
 *
 * Return the current user's unread notifications (newest first), capped at 50.
 * Use /api/notifications/read to mark individual notifications read.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabase
    .from("notifications")
    .select("id, type, payload, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadCount = (rows ?? []).filter((r) => !(r as { read: boolean }).read).length;

  return NextResponse.json({
    notifications: rows ?? [],
    unread_count: unreadCount,
  });
}
