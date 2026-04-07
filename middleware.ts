import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── Auth callback: handle verification IN middleware where cookie
  // setting on redirect responses is guaranteed to work. ──
  // Catch auth params on ANY page (Supabase may redirect to / instead of /auth/callback)
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (code || tokenHash) {
    return handleAuthCallback(request, code, tokenHash, type);
  }

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".")
  ) {
    return refreshSession(request);
  }

  return protectedRoute(request);
}

// ── Auth callback handler (runs in middleware context) ──────────────────────
async function handleAuthCallback(
  request: NextRequest,
  code: string | null,
  tokenHash: string | null,
  type: string | null,
): Promise<NextResponse> {
  const next = request.nextUrl.searchParams.get("next") ?? "/garage";
  const safeNext = next.startsWith("/") ? next : "/garage";
  const origin = request.nextUrl.origin;

  // Create a redirect response — cookies will be set directly on this
  let response = NextResponse.redirect(new URL(safeNext, request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.redirect(new URL(safeNext, request.url));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Flow 1: Email OTP verification (token_hash + type)
  if (tokenHash && type) {
    console.log("[auth/middleware] OTP flow — type:", type);
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "recovery" | "invite" | "magiclink" | "email",
    });

    if (!error) {
      console.log("[auth/middleware] OTP success, user:", data?.user?.id);
      return response;
    }

    console.error("[auth/middleware] OTP failed:", error.message, error.status);
    return NextResponse.redirect(
      new URL(`/login?error=verification_failed`, request.url)
    );
  }

  // Flow 2: OAuth / PKCE code exchange
  if (code) {
    console.log("[auth/middleware] PKCE code exchange");
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      console.log("[auth/middleware] Code exchange success, user:", data?.user?.id);
      return response;
    }

    console.error("[auth/middleware] Code exchange failed:", error.message, error.status);
    return NextResponse.redirect(
      new URL(`/login?error=auth_callback_failed`, request.url)
    );
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", request.url));
}

// ── Session refresh for public routes ──────────────────────────────────────
async function refreshSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

// ── Protected route guard ──────────────────────────────────────────────────
async function protectedRoute(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
