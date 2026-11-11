import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/server";

/**
 * Privileged Supabase client. Bypasses Row Level Security.
 *
 * Use only in server-only code paths such as webhooks, platform administration,
 * and scheduled reconciliation. Never expose the result or the key to a client.
 */
export function createAdminClient() {
  const env = getServerEnv();

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
