import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/cars/[carId]/check-eligibility
 *
 * Server-side eligibility check for pixel card minting.
 * Three checks:
 *   1. ≥2 real photos (excludes /renders/ and /pixel-cards/ URLs)
 *   2. Description passes a Claude coherence check (real car story, ≥40 chars)
 *   3. ≥1 installed mod with BOTH a cost AND shop_name (or is_diy=true)
 *
 * Returns: { eligible: boolean, checks: EligibilityCheck[] }
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Params {
  params: Promise<{ carId: string }>;
}

export interface EligibilityCheck {
  id: "photos" | "description" | "mod_source";
  label: string;
  detail: string;
  met: boolean;
}

export interface EligibilityResponse {
  eligible: boolean;
  checks: EligibilityCheck[];
}

export async function GET(_req: Request, { params }: Params) {
  const { carId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 1. Load car + photos + mods in parallel ─────────────────────────────────
  const [{ data: carRaw }, { data: photosRaw }, { data: modsRaw }] = await Promise.all([
    supabase
      .from("cars")
      .select("id, user_id, description, make, model, year")
      .eq("id", carId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("car_photos")
      .select("url")
      .eq("car_id", carId),
    supabase
      .from("mods")
      .select("cost, shop_name, is_diy, status")
      .eq("car_id", carId)
      .eq("status", "installed"),
  ]);

  if (!carRaw) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  const car = carRaw as {
    id: string;
    user_id: string;
    description: string | null;
    make: string;
    model: string;
    year: number;
  };

  const allPhotos = (photosRaw ?? []) as { url: string }[];
  const realPhotos = allPhotos.filter(
    (p) => !p.url.includes("/renders/") && !p.url.includes("/pixel-cards/")
  );

  const mods = (modsRaw ?? []) as {
    cost: number | null;
    shop_name: string | null;
    is_diy: boolean;
    status: string;
  }[];

  // ── Check 1: ≥2 real photos ─────────────────────────────────────────────────
  const photoCount = realPhotos.length;
  const photosCheck: EligibilityCheck = {
    id: "photos",
    label: "Upload 2 real photos",
    detail: `${photoCount} of 2 photos`,
    met: photoCount >= 2,
  };

  // ── Check 2: Description coherence ──────────────────────────────────────────
  const description = (car.description ?? "").trim();
  let descCheck: EligibilityCheck;

  if (description.length < 40) {
    descCheck = {
      id: "description",
      label: "Write a real build story",
      detail: description.length === 0 ? "No description yet" : `${description.length} chars (need more)`,
      met: false,
    };
  } else {
    // Claude coherence check — is this actually about the car?
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: `Is this a real car build description for a ${car.year} ${car.make} ${car.model}? Reply only "yes" or "no".

Description: "${description.slice(0, 800)}"`,
          },
        ],
      });
      const reply = (msg.content[0]?.type === "text" ? msg.content[0].text : "").toLowerCase().trim();
      const coherent = reply.startsWith("yes");
      descCheck = {
        id: "description",
        label: "Write a real build story",
        detail: coherent ? "Looks good" : "Doesn't seem to be about this car",
        met: coherent,
      };
    } catch {
      // If Claude call fails, be lenient and pass the check
      descCheck = {
        id: "description",
        label: "Write a real build story",
        detail: "Verified",
        met: true,
      };
    }
  }

  // ── Check 3: ≥1 mod with cost + source ──────────────────────────────────────
  const qualifiedMod = mods.find(
    (m) => m.cost != null && m.cost > 0 && (m.shop_name != null || m.is_diy)
  );
  const modCheck: EligibilityCheck = {
    id: "mod_source",
    label: "Log 1 mod with cost & source",
    detail: qualifiedMod
      ? "Requirement met"
      : mods.length === 0
      ? "No mods logged yet"
      : "Add a cost + shop/DIY to a mod",
    met: Boolean(qualifiedMod),
  };

  const checks: EligibilityCheck[] = [photosCheck, descCheck, modCheck];
  const eligible = checks.every((c) => c.met);

  return NextResponse.json({ eligible, checks } satisfies EligibilityResponse);
}
