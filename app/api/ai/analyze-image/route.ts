import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
  image_base64: z.string().min(100).max(10_000_000),
  media_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  car_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`analyze:${user.id}`, AI_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = bodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { image_base64, media_type, car_id } = result.data;

  let carContext = "";
  if (car_id) {
    const { data: carRaw } = await supabase
      .from("cars")
      .select("make, model, year, trim")
      .eq("id", car_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (carRaw) {
      carContext = `\nKnown vehicle: ${carRaw.year} ${carRaw.make} ${carRaw.model}${carRaw.trim ? ` ${carRaw.trim}` : ""}`;
    }
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type,
                data: image_base64,
              },
            },
            {
              type: "text",
              text: `You are an expert automotive analyst. Analyze this car image.${carContext}

Return a JSON object with these fields:
{
  "detected_vehicle": "Year Make Model (if identifiable, otherwise 'Unknown')",
  "visible_mods": ["list of clearly visible modifications"],
  "stock_parts": ["notable stock parts visible"],
  "condition": "excellent/good/fair/poor",
  "color": "specific color name",
  "stance": "description of stance/ride height",
  "body_style": "sedan/coupe/hatch/wagon/suv/truck/etc",
  "suggestions": [
    {
      "name": "modification name",
      "category": "engine/suspension/aero/interior/wheels/exhaust/electronics/other",
      "reason": "why this mod would complement what you see in the image",
      "estimated_cost": "$XXX-$X,XXX",
      "priority": "high/medium/low",
      "amazon_url": "https://www.amazon.com/s?k=SPECIFIC+SEARCH+QUERY",
      "summit_url": "https://www.summitracing.com/search?searchString=SPECIFIC+SEARCH+QUERY"
    }
  ],
  "overall_assessment": "2-3 sentence summary of the car and its current state"
}

Provide 5-7 specific, relevant modification suggestions based on what you actually see. Make the search URLs specific to the car and mod type. Return ONLY valid JSON, no markdown.`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    let analysis: unknown;
    try {
      const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      analysis = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("Image analysis error:", err);
    return NextResponse.json({ error: "Failed to analyze image. Please try again." }, { status: 500 });
  }
}
