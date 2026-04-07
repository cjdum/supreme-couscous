import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/garage";

  // Only allow relative redirects
  const safeNext = next.startsWith("/") ? next : "/garage";

  const cookieStore = await cookies();

  // Build a Supabase client that writes cookies onto the REDIRECT response
  // so the session actually persists after the redirect.
  let redirectResponse = NextResponse.redirect(`${origin}${safeNext}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies both to the cookie store AND the redirect response
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch { /* server component */ }
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Flow 1: Email OTP verification (token_hash + type from confirmation email)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "recovery" | "invite" | "magiclink" | "email",
    });

    if (!error) {
      console.log("[auth/callback] OTP verification succeeded, redirecting to", safeNext);
      return redirectResponse;
    }

    console.error("[auth/callback] OTP verification failed:", {
      type,
      error: error.message,
      status: error.status,
    });
    return NextResponse.redirect(
      `${origin}/login?error=verification_failed&next=${encodeURIComponent(safeNext)}`
    );
  }

  // Flow 2: OAuth / PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      console.log("[auth/callback] Code exchange succeeded, redirecting to", safeNext);
      return redirectResponse;
    }

    console.error("[auth/callback] Code exchange failed:", {
      error: error.message,
      status: error.status,
    });
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed&next=${encodeURIComponent(safeNext)}`
    );
  }

  // No auth params at all
  console.error("[auth/callback] No code or token_hash in URL:", request.url);
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
