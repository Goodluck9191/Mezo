import "server-only";

import { redirect } from "next/navigation";

import type { Database } from "@/types/database";

import { createClient } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  email: string | null;
};

export type RestaurantRole = Database["public"]["Enums"]["restaurant_role"];
export type ApplicationStatus = Database["public"]["Enums"]["application_status"];
export type OperationalStatus = Database["public"]["Enums"]["operational_status"];

/** A restaurant membership of the current user, joined with the restaurant. */
export interface Membership {
  restaurantId: string;
  role: RestaurantRole;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    operationalStatus: OperationalStatus;
    applicationStatus: ApplicationStatus;
  };
}

/** Loose profile row type matching public.profiles. */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Loose application row type matching public.restaurant_applications. */
export type RestaurantApplication = Database["public"]["Tables"]["restaurant_applications"]["Row"];

/**
 * Returns the authenticated user or null. Never throws.
 * `getUser()` revalidates the session server-side, including token refresh.
 */
export async function getUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { id: user.id, email: user.email ?? null };
}

/**
 * Requiring a session for page renders. Redirects to /login with `next` set
 * to the plain path of the page being requested.
 */
export async function requireUser(returnTo: string = "/"): Promise<AppUser> {
  const user = await getUser();

  if (!user) {
    // Only allow local, non-protocol-relative paths.
    const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
    redirect(`/login?next=${encodeURIComponent(safe)}`);
  }

  return user;
}

/** All active memberships of `userId`, cheaply joined to the restaurant row. */
export async function getMemberships(userId: string): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_members")
    .select(
      "role, restaurant_id, restaurant:restaurants!inner(id, name, slug, operational_status, application_status)",
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const restaurant = row.restaurant as unknown as {
      id: string;
      name: string;
      slug: string;
      operational_status: OperationalStatus;
      application_status: ApplicationStatus;
    };

    return {
      restaurantId: row.restaurant_id,
      role: row.role,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        operationalStatus: restaurant.operational_status,
        applicationStatus: restaurant.application_status,
      },
    };
  });
}

/** Restaurants in which the user holds one of the given roles. */
export async function membershipsWithRole(
  userId: string,
  roles: readonly RestaurantRole[],
): Promise<Membership[]> {
  const memberships = await getMemberships(userId);
  return memberships.filter((membership) => roles.includes(membership.role));
}

/**
 * Server guard: at least one active membership holding one of `roles`.
 * Redirects to `fallback` (default `/`) when the user has none.
 */
/**
 * Server guard: at least one active membership holding one of `roles`.
 * Redirects to `fallback` (default '/') when the user has none.
 */
export async function requireRestaurantRole(
  roles: readonly RestaurantRole[],
  fallback: string = "/",
): Promise<Membership[]> {
  const user = await requireUser();
  const memberships = await membershipsWithRole(user.id, roles);

  if (memberships.length === 0) {
    redirect(fallback);
  }

  return memberships;
}

/** Only platform administrators may use this page. Non-admins go to `fallback`. */
export async function requirePlatformAdmin(
  fallback: string = "/",
  returnTo: string = "/platform",
): Promise<AppUser> {
  const user = await requireUser(returnTo);

  if (await isPlatformAdmin()) {
    return user;
  }

  redirect(fallback);
}

/** True when the current user is registered as a platform administrator. */
export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getUser();

  if (!user) {
    return false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return !error && data !== null;
}
