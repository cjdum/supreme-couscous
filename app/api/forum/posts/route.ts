import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  category: z.enum(["general", "build", "advice", "showcase", "for_sale"]).default("general"),
  car_id: z.string().uuid().optional().nullable(),
});

type RawPost = {
  id: string;
  title: string;
  content: string;
  category: string;
  likes_count: number;
  replies_count: number;
  created_at: string;
  car_id: string | null;
  user_id: string;
};

const BASE_SELECT =
  "id, title, content, category, likes_count, replies_count, created_at, car_id, user_id";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "new"; // hot | new | top
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let postsRaw: RawPost[] | null = null;
  let fetchError: { message: string } | null = null;

  const buildQuery = (applyCategoryFilter: boolean) => {
    let q = supabase
      .from("forum_posts")
      .select(BASE_SELECT)
      .range(offset, offset + limit - 1);
    if (applyCategoryFilter && category && category !== "all") {
      q = q.eq("category", category);
    }
    return q;
  };

  if (sort === "top") {
    const q = buildQuery(true).order("likes_count", { ascending: false });
    const { data, error } = await q;
    postsRaw = (data ?? []) as RawPost[];
    fetchError = error;
  } else if (sort === "hot") {
    // Hot = high engagement posts in last 30 days; fallback to all-time if empty
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: e1 } = await buildQuery(true)
      .gte("created_at", cutoff)
      .order("likes_count", { ascending: false });
    fetchError = e1;

    if (recent && recent.length > 0) {
      postsRaw = recent as RawPost[];
    } else {
      // Fallback: all-time by likes
      const { data: fallback, error: e2 } = await buildQuery(true).order("likes_count", { ascending: false });
      postsRaw = (fallback ?? []) as RawPost[];
      fetchError = e2;
    }
  } else {
    // new (default)
    const { data, error } = await buildQuery(true).order("created_at", { ascending: false });
    postsRaw = (data ?? []) as RawPost[];
    fetchError = error;
  }

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
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

  // Step 2b: fetch each user's primary car (for the username car badge)
  const { data: primaryCarsRaw } = await supabase
    .from("cars")
    .select("user_id, make, model, year")
    .in("user_id", userIds)
    .eq("is_primary", true);
  const primaryCarMap = new Map<string, { make: string; model: string; year: number }>();
  for (const car of primaryCarsRaw ?? []) {
    primaryCarMap.set(car.user_id, { make: car.make, model: car.model, year: car.year });
  }

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
    downvotes_count: 0,
    profiles: profileMap.get(post.user_id) ?? { username: "unknown", display_name: null, avatar_url: null },
    primary_car: primaryCarMap.get(post.user_id) ?? null,
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
