import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, API_RATE_LIMIT } from "@/lib/rate-limit";

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

export async function GET(request: Request) {
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`vin:${user.id}`, API_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const vin = searchParams.get("vin")?.toUpperCase() ?? "";

  if (!VIN_REGEX.test(vin)) {
    return NextResponse.json(
      { error: "Invalid VIN — must be 17 alphanumeric characters (no I, O, Q)" },
      { status: 400 }
    );
  }

  try {
    // Use NHTSA free VIN decoder API
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vin)}?format=json`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!res.ok) {
      throw new Error(`NHTSA API responded with ${res.status}`);
    }

    const data = await res.json() as {
      Results?: {
        Make?: string;
        Model?: string;
        ModelYear?: string;
        Trim?: string;
        ErrorCode?: string;
        ErrorText?: string;
      }[];
    };
    const decoded = data.Results?.[0];

    if (!decoded || decoded.ErrorCode !== "0") {
      return NextResponse.json(
        { error: "VIN not found or invalid. Please enter vehicle details manually." },
        { status: 404 }
      );
    }

    if (!decoded.Make || !decoded.Model || !decoded.ModelYear) {
      return NextResponse.json(
        { error: "Could not decode this VIN. Please enter details manually." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      make: decoded.Make,
      model: decoded.Model,
      year: parseInt(decoded.ModelYear),
      trim: decoded.Trim || null,
      vin,
    });
  } catch (err) {
    console.error("VIN lookup error:", err);
    return NextResponse.json(
      { error: "VIN lookup service unavailable. Please enter details manually." },
      { status: 503 }
    );
  }
}
