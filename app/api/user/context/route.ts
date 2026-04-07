import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchUserContext, formatContextForPrompt } from "@/lib/user-context";

/**
 * GET /api/user/context
 *
 * Returns the authenticated user's full context. Single source of truth used
 * by client features that need to know what's in the user's garage.
 *
 * Append `?debug=1` to also receive the formatted prompt block + raw counts so
 * you can verify exactly what every AI feature sees.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn("[api/user/context] no user — auth cookie missing or expired");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";

  console.log(`[api/user/context] user=${user.id} email=${user.email ?? "?"} debug=${debug}`);

  try {
    const ctx = await fetchUserContext(supabase, user.id);

    const installedCount = ctx.allMods.filter((m) => m.status === "installed").length;
    const wishlistCount = ctx.allMods.filter((m) => m.status === "wishlist").length;

    console.log(
      `[api/user/context] returning user=${user.id} profile=${ctx.profile ? "yes" : "no"} cars=${ctx.cars.length} mods=${ctx.allMods.length} (installed=${installedCount} wishlist=${wishlistCount})`
    );

    if (ctx.cars.length === 0) {
      console.warn(
        `[api/user/context] EMPTY CARS for user ${user.id}. Possible causes: 1) user really has no cars, 2) RLS policy blocking, 3) supabase auth context not propagating. Email=${user.email}`
      );
    }

    const payload: Record<string, unknown> = {
      profile: ctx.profile,
      cars: ctx.cars,
      primaryCarId: ctx.primaryCarId,
      buildScore: ctx.buildScore,
      forumPostCount: ctx.forumPostCount,
      forumReplyCount: ctx.forumReplyCount,
    };

    if (debug) {
      payload.debug = {
        userId: user.id,
        email: user.email,
        modCount: ctx.allMods.length,
        installedCount,
        wishlistCount,
        formattedPrompt: formatContextForPrompt(ctx),
      };
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/user/context] fatal:", err);
    return NextResponse.json(
      { error: "Failed to load context", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
