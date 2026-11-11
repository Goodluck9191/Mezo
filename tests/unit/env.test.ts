import { describe, expect, it } from "vitest";

import { publicEnvSchema, supabaseEnvSchema } from "@/lib/env/shared";

const validSupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
};

describe("supabaseEnvSchema", () => {
  it("accepts a valid project configuration", () => {
    expect(supabaseEnvSchema.safeParse(validSupabaseEnv).success).toBe(true);
  });

  it("rejects missing keys", () => {
    const result = supabaseEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: validSupabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-http URLs", () => {
    const result = supabaseEnvSchema.safeParse({
      ...validSupabaseEnv,
      NEXT_PUBLIC_SUPABASE_URL: "postgres://example.supabase.co",
    });

    expect(result.success).toBe(false);
  });
});

describe("publicEnvSchema", () => {
  it("requires a canonical app URL", () => {
    const result = publicEnvSchema.safeParse({
      ...validSupabaseEnv,
      NEXT_PUBLIC_APP_URL: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  it("accepts the full public configuration", () => {
    const result = publicEnvSchema.safeParse({
      ...validSupabaseEnv,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });

    expect(result.success).toBe(true);
  });
});
