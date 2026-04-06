import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
  car_id: z.string().uuid(),
});

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

  const result = bodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid car_id" }, { status: 400 });
  }

  const { car_id } = result.data;

  const { data: carRaw } = await supabase
    .from("cars")
    .select("make, model, year, trim")
    .eq("id", car_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!carRaw) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Return the STOCK factory specifications for a ${carRaw.year} ${carRaw.make} ${carRaw.model}${carRaw.trim ? ` ${carRaw.trim}` : ""}.

Return ONLY a JSON object with these exact fields (use null for unknown values):
{
  "horsepower": <integer or null>,
  "torque": <integer lb-ft or null>,
  "engine_size": "<string like '2.0L Turbocharged Inline-4' or null>",
  "drivetrain": "<RWD|FWD|AWD|4WD or null>",
  "transmission": "<string like '6-speed Manual' or null>",
  "curb_weight": <integer lbs or null>,
  "zero_to_sixty": <decimal seconds or null>,
  "top_speed": <integer mph or null>
}

Use the BASE trim spec if trim is unknown. Return ONLY the JSON object, no markdown.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    let specs: unknown;
    try {
      const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      specs = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse specs" }, { status: 500 });
    }

    // Save to database
    const { error: updateError } = await supabase
      .from("cars")
      .update({
        ...(specs as Record<string, unknown>),
        specs_ai_guessed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", car_id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to save specs:", updateError);
    }

    return NextResponse.json({ specs, saved: !updateError });
  } catch (err) {
    console.error("Vehicle specs error:", err);
    return NextResponse.json({ error: "Failed to get specs. Please try again." }, { status: 500 });
  }
}
