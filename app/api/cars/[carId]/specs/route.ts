import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const specsSchema = z.object({
  horsepower: z.number().int().min(1).max(5000).nullable().optional(),
  torque: z.number().int().min(1).max(10000).nullable().optional(),
  engine_size: z.string().max(80).nullable().optional(),
  drivetrain: z.enum(["RWD", "FWD", "AWD", "4WD"]).nullable().optional(),
  transmission: z.string().max(80).nullable().optional(),
  curb_weight: z.number().int().min(100).max(20000).nullable().optional(),
  zero_to_sixty: z.number().min(0).max(60).nullable().optional(),
  top_speed: z.number().int().min(30).max(500).nullable().optional(),
});

interface Params {
  params: Promise<{ carId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  const { carId } = await params;
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

  const result = specsSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const { error } = await supabase
    .from("cars")
    .update({
      ...result.data,
      specs_ai_guessed: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", carId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
