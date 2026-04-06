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

  const { data, error } = await supabase
    .from("forum_replies")
    .select(`
      id, content, created_at,
      profiles!inner(username, display_name, avatar_url)
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ replies: data ?? [] });
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

  // Insert reply
  const { data: reply, error: replyError } = await supabase
    .from("forum_replies")
    .insert({ user_id: user.id, post_id: postId, content: result.data.content })
    .select(`id, content, created_at, profiles!inner(username, display_name, avatar_url)`)
    .single();

  if (replyError) {
    return NextResponse.json({ error: replyError.message }, { status: 500 });
  }

  // Increment replies count via manual update
  const { data: postData } = await supabase
    .from("forum_posts")
    .select("replies_count")
    .eq("id", postId)
    .single();
  if (postData) {
    await supabase
      .from("forum_posts")
      .update({ replies_count: (postData.replies_count ?? 0) + 1 })
      .eq("id", postId);
  }

  return NextResponse.json({ reply }, { status: 201 });
}
