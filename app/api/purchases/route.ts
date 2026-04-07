import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Purchase } from "@/lib/supabase/types";

const createSchema = z.object({
  item_name: z.string().min(1).max(200),
  price: z.number().min(0).max(1_000_000),
  retailer: z.string().max(120).nullable().optional(),
  purchased_at: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
  car_id: z.string().uuid().nullable().optional(),
  mod_id: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .order("purchased_at", { ascending: false });

  if (error) {
    return NextResponse.json({ purchases: [] as Purchase[] });
  }

  return NextResponse.json({ purchases: (data ?? []) as Purchase[] });
}

export async function POST(request: Request) {
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

  const result = createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("purchases")
    .insert({
      user_id: user.id,
      item_name: result.data.item_name,
      price: result.data.price,
      retailer: result.data.retailer ?? null,
      purchased_at: result.data.purchased_at ?? new Date().toISOString().slice(0, 10),
      notes: result.data.notes ?? null,
      car_id: result.data.car_id ?? null,
      mod_id: result.data.mod_id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purchase: data as Purchase });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("purchases")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
