import {
  formatEnvError,
  publicEnvSchema,
  supabaseEnvSchema,
  type PublicEnv,
  type SupabaseEnv,
} from "@/lib/env/shared";

let cachedSupabaseEnv: SupabaseEnv | null = null;
let cachedPublicEnv: PublicEnv | null = null;

/**
 * Browser-safe Supabase configuration.
 * Throws a readable error when the project has not been configured yet.
 */
export function getSupabaseEnv(): SupabaseEnv {
  if (cachedSupabaseEnv) {
    return cachedSupabaseEnv;
  }

  const parsed = supabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Supabase is not configured.\n${formatEnvError(parsed.error)}\n` +
        "Copy .env.example to .env.local and provide your project values.",
    );
  }

  cachedSupabaseEnv = parsed.data;
  return cachedSupabaseEnv;
}

/**
 * Returns null instead of throwing when Supabase is not configured.
 * Used by the proxy so the marketing site can run before Phase 3.
 */
export function getOptionalSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return getSupabaseEnv();
}

/**
 * Public application configuration, including the canonical app URL.
 */
export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv;
  }

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    throw new Error(
      `Public environment is not configured.\n${formatEnvError(parsed.error)}\n` +
        "Copy .env.example to .env.local and provide your project values.",
    );
  }

  cachedPublicEnv = parsed.data;
  return cachedPublicEnv;
}
