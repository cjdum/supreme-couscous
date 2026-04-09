import type { SupabaseClient } from "@supabase/supabase-js";
import type { Car } from "./types";

/**
 * Single-car model: return the user's primary car, falling back to the
 * earliest-created row if no `is_primary=true` exists. Legacy accounts that
 * have more than one car in the database silently pick one of them — the
 * extras stay in the DB but are invisible to the UI.
 *
 * The DB-side ordering (`is_primary desc, created_at desc`) plus the in-memory
 * `.find(...)` mirrors what `lib/user-context.ts` does for consistency.
 *
 * Works with both the server client (`lib/supabase/server.ts`) and the browser
 * client (`lib/supabase/client.ts`) — pass whichever you already have.
 */
export async function getPrimaryCar(
  supabase: SupabaseClient,
  userId: string,
): Promise<Car | null> {
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[get-primary-car] query error:", error.message);
    return null;
  }
  const rows = (data ?? []) as Car[];
  return rows.find((c) => c.is_primary) ?? rows[0] ?? null;
}

/** Same as `getPrimaryCar` but returns just the id — use when nothing else is needed. */
export async function getPrimaryCarId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const car = await getPrimaryCar(supabase, userId);
  return car?.id ?? null;
}
