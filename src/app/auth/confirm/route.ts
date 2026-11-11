import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for emailed verification links (sign up, password reset,
 * email change). Supabase links to /auth/confirm?token_hash=...&type=... The
 * hash is exchanged for a session server-side, then the user is sent to the
 * appropriate next step.
 *
 * `next` is always validated against an allow-list so the flow cannot be used
 * as an open redirect.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const nextParam = url.searchParams.get("next");

  const allowedTypes = new Set([
    "signup",
    "email_change",
    "recovery",
    "invite",
    "magiclink",
    "email",
  ]);

  if (!tokenHash || !type || !allowedTypes.has(type)) {
    return NextResponse.redirect(new URL("/login?error=invalid-link", url.origin));
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "signup" | "email" | "email_change" | "recovery" | "invite" | "magiclink",
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid-link", url.origin));
  }

  const defaultNext: Record<string, string> = {
    signup: "/restaurant/apply",
    email: "/profile",
    email_change: "/profile",
    recovery: "/reset-password",
    invite: "/register",
    magiclink: "/login",
  };

  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : (defaultNext[type] ?? "/");

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
