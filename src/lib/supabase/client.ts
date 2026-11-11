"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env/client";

/**
 * Supabase client for Client Components and browser event handlers.
 * Creates a new client per call; @supabase/ssr reuses the underlying session.
 */
export function createClient() {
  const env = getSupabaseEnv();

  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
