import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const replySchema = z.object({
  content: z.string().min(1).max(2000),
});

interface Params {
  params: Promise<{ postId: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { postId } = await params;
  const supabase = await createClient();

  // Fetch replies, then join profiles manually
  const { data: repliesRaw, error } = await supabase
    .from("forum_replies")
    .select("id, content, created_at, user_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const replies = repliesRaw ?? [];
  if (replies.length === 0) {
    return NextResponse.json({ replies: [] });
  }

  // Fetch profiles for user_ids
  const userIds = [...new Set(replies.map((r) => r.user_id))];
  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .in("user_id", userIds);
  const profileMap = new Map((profilesRaw ?? []).map((p) => [p.user_id, p]));

  const merged = replies.map((r) => ({
    ...r,
    profiles: profileMap.get(r.user_id) ?? { username: "unknown", display_name: null, avatar_url: null },
  }));

  return NextResponse.json({ replies: merged });
}

export async function POST(request: Request, { params }: Params) {
  const { postId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = replySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  // Insert reply (trigger auto-updates replies_count on forum_posts)
  const { data: reply, error: replyError } = await supabase
    .from("forum_replies")
    .insert({ user_id: user.id, post_id: postId, content: result.data.content })
    .select("id, content, created_at, user_id")
    .single();

  if (replyError) {
    return NextResponse.json({ error: replyError.message }, { status: 500 });
  }

  // Get profile for this user
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    reply: {
      ...reply,
      profiles: profile ?? { username: "unknown", display_name: null, avatar_url: null },
    },
  }, { status: 201 });
}
