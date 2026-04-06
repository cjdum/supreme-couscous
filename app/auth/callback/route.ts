import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/garage";

  // Only allow relative redirects to prevent open redirect attacks
  const safeNext = next.startsWith("/") ? next : "/garage";

  const supabase = await createClient();

  // Handle email verification via token_hash (OTP / confirmation email flow)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "recovery" | "invite" | "magiclink" | "email",
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    console.error("OTP verification error:", error.message);
    return NextResponse.redirect(`${origin}/login?error=verification_failed`);
  }

  // Handle OAuth / PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    console.error("Code exchange error:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
