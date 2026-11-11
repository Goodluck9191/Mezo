import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getOptionalSupabaseEnv } from "@/lib/env/client";

let warnedMissingEnv = false;

/**
 * Refreshes the Supabase auth session and keeps cookies in sync.
 *
 * This runs in proxy.ts (Next.js 16's renamed middleware). It is a convenience
 * layer only: authorization is enforced by Postgres Row Level Security.
 */
export async function updateSession(request: NextRequest) {
  const env = getOptionalSupabaseEnv();

  if (!env) {
    if (process.env.NODE_ENV === "development" && !warnedMissingEnv) {
      warnedMissingEnv = true;
      console.warn("[mezo] Supabase environment is not configured; session refresh is skipped.");
    }

    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Do not remove: refreshes expired tokens and writes updated cookies.
  await supabase.auth.getUser();

  return response;
}
