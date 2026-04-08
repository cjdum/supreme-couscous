import { NextResponse } from "next/server";

/**
 * POST /api/ai/analyze-image
 *
 * DEPRECATED — per the ModVault spec, AI no longer analyzes user images for
 * content understanding. All car understanding must come from typed text
 * fields (year, make, model, trim, color, mods list) on the car record.
 *
 * This endpoint now returns 410 Gone so any legacy callers fail loudly and
 * get migrated to the text-only flow.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Image analysis is no longer supported. All car understanding now comes from the typed fields on your car — edit the car in your garage instead.",
    },
    { status: 410 },
  );
}
