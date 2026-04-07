import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/user/delete
 *
 * Soft-deletes the user's account: removes profile, cars, mods, etc. via cascades.
 * Note: actually removing the auth.users row requires the service role key, which
 * we don't have in the client-facing app. For now we wipe their data and sign them out.
 * The user should be told to email support to fully delete the auth record.
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  console.log(`[user/delete] wiping data for user ${user.id}`);

  try {
    // Cars cascade -> mods, photos, renders
    await supabase.from("cars").delete().eq("user_id", user.id);
    await supabase.from("forum_posts").delete().eq("user_id", user.id);
    await supabase.from("forum_replies").delete().eq("user_id", user.id);
    try {
      await supabase.from("forum_likes").delete().eq("user_id", user.id);
    } catch {
      /* table may not exist */
    }
    try {
      await supabase.from("forum_downvotes").delete().eq("user_id", user.id);
    } catch {
      /* table may not exist */
    }
    await supabase.from("profiles").delete().eq("user_id", user.id);
    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[user/delete] error:", err);
    return NextResponse.json(
      { error: "Failed to delete account. Please contact support." },
      { status: 500 }
    );
  }
}
