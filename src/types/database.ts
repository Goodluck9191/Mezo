/**
 * Placeholder for generated Supabase types.
 *
 * In Phase 2, replace this file with:
 *   npx supabase gen types typescript --local > src/types/database.ts
 *
 * Do not hand-maintain table definitions here.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
