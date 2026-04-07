import { NextResponse } from "next/server";

// Auth verification is handled in middleware (where cookie-setting on
// redirects is reliable). This route exists only as a landing URL for
// Supabase email links — middleware intercepts the request before it
// reaches here. If it somehow gets through, redirect to garage.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  console.log("[auth/callback] Route handler hit — middleware should have caught this");
  return NextResponse.redirect(`${origin}/garage`);
}
