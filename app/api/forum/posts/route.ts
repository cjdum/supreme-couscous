import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(5000),
  category: z.enum(["general", "build", "advice", "showcase", "for_sale"]).default("general"),
  car_id: z.string().uuid().optional().nullable(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "new"; // hot | new | top
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  // Step 1: fetch posts (without profile join — no direct FK)
  let query = supabase
    .from("forum_posts")
    .select("id, title, content, category, likes_count, replies_count, created_at, car_id, user_id")
    .range(offset, offset + limit - 1);

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  if (sort === "top") {
    query = query.order("likes_count", { ascending: false });
  } else if (sort === "hot") {
    // hot = recent posts with high engagement; simple heuristic: sort by (likes+replies) desc, within last 7 days
    query = query
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("likes_count", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: postsRaw, error: postsError } = await query;

  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }

  const posts = postsRaw ?? [];
  if (posts.length === 0) {
    return NextResponse.json({ posts: [] });
  }

  // Step 2: fetch profiles for the user_ids
  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .in("user_id", userIds);
  const profileMap = new Map(
    (profilesRaw ?? []).map((p) => [p.user_id, p])
  );

  // Step 3: fetch cars for posts that have car_id
  const carIds = [...new Set(posts.map((p) => p.car_id).filter(Boolean))] as string[];
  const carMap = new Map<string, { make: string; model: string; year: number; cover_image_url: string | null }>();
  if (carIds.length > 0) {
    const { data: carsRaw } = await supabase
      .from("cars")
      .select("id, make, model, year, cover_image_url")
      .in("id", carIds);
    for (const car of carsRaw ?? []) {
      carMap.set(car.id, car);
    }
  }

  // Step 4: merge
  const merged = posts.map((post) => ({
    ...post,
    profiles: profileMap.get(post.user_id) ?? { username: "unknown", display_name: null, avatar_url: null },
    cars: post.car_id ? carMap.get(post.car_id) ?? null : null,
  }));

  return NextResponse.json({ posts: merged });
}

export async function POST(request: Request) {
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

  const result = createPostSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("forum_posts")
    .insert({
      user_id: user.id,
      ...result.data,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
