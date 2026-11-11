"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Customer (QR) sign-in. Customers never register, they only get an
 * anonymous session the first time they scan a table code. That session
 * authorises exactly one ghost guest per table session.
 *
 * This is the single entry point used by the QR ordering flow (Phase 5).
 */
export async function signInAnonymously() {
  const supabase = createClient();
  const { data: current } = await supabase.auth.getSession();

  if (current.session?.user) {
    return current;
  }

  return supabase.auth.signInAnonymously();
}
