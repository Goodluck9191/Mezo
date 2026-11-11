import { z } from "zod";

const httpUrl = z
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Must be an http:// or https:// URL");

export const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: httpUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "Supabase anon key looks too short. Did you copy the real key?"),
});

export const publicEnvSchema = supabaseEnvSchema.extend({
  NEXT_PUBLIC_APP_URL: httpUrl,
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Formats validation issues without ever echoing secret values.
 */
export function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "environment";
      return `  - ${key}: ${issue.message}`;
    })
    .join("\n");
}
