import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ car_id: z.string().uuid() });

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

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid car_id" }, { status: 400 });
  }

  const { car_id } = result.data;

  // Verify car belongs to user
  const { data: car } = await supabase
    .from("cars")
    .select("id")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!car) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  // Clear existing primary, set new one
  await supabase.from("cars").update({ is_primary: false }).eq("user_id", user.id);
  const { error } = await supabase.from("cars").update({ is_primary: true }).eq("id", car_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
