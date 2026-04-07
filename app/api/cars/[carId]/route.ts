import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ carId: string }>;
}

const updateSchema = z.object({
  make: z.string().min(1).max(50).optional(),
  model: z.string().min(1).max(80).optional(),
  year: z.number().int().min(1886).max(new Date().getFullYear() + 1).optional(),
  trim: z.string().max(80).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  nickname: z.string().max(60).nullable().optional(),
  is_public: z.boolean().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  vin: z.string().length(17).nullable().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const { data, error } = await supabase
    .from("cars")
    .update({ ...result.data, updated_at: new Date().toISOString() })
    .eq("id", carId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ car: data });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cards survive — schema sets pixel_cards.car_id to NULL on delete cascade
  const { error } = await supabase
    .from("cars")
    .delete()
    .eq("id", carId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
