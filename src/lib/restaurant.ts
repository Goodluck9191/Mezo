import "server-only";

import { notFound, redirect } from "next/navigation";

import type { Database } from "@/types/database";

import {
  getAdministeredRestaurants,
  membershipsWithRole,
  requireUser,
  type ApplicationStatus,
  type Membership,
  type OperationalStatus,
} from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

/** Invitation row without the token hash — the only columns clients may read. */
export type StaffInvitationRow = Pick<
  Database["public"]["Tables"]["restaurant_staff_invitations"]["Row"],
  | "id"
  | "restaurant_id"
  | "email"
  | "role"
  | "status"
  | "invited_by"
  | "accepted_user_id"
  | "accepted_at"
  | "expires_at"
  | "created_at"
  | "updated_at"
>;

/** Full restaurant row plus the active membership for it. */
export interface ActiveRestaurant {
  membership: Membership;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    countryCode: string;
    applicationStatus: ApplicationStatus;
    operationalStatus: OperationalStatus;
    subscriptionStatus: Database["public"]["Enums"]["subscription_status"];
    createdAt: string;
  };
}

export interface StaffMemberSummary {
  memberId: string;
  userId: string;
  role: Database["public"]["Enums"]["restaurant_role"];
  isActive: boolean;
  fullName: string | null;
  memberSince: string;
}

export interface WorkspaceData {
  /** Admin memberships of this user, most relevant slug first. */
  memberships: Membership[];
  /** The restaurant selected for this request, or null when there are none. */
  active: ActiveRestaurant | null;
  /** True when `?restaurant=` pointed at a restaurant the user does not administer. */
  unknownRestaurant: boolean;
}

/**
 * Load the admin workspace for `userId`, selecting the restaurant identified by
 * `slug` (or the first membership when no slug is given). The restaurants row
 * is loaded under the caller's RLS context; a slug that is not among the
 * caller's memberships yields `unknownRestaurant` instead of a row.
 */
export async function getRestaurantWorkspace(
  userId: string,
  slug: string | undefined,
): Promise<WorkspaceData> {
  const memberships = await getAdministeredRestaurants(userId);

  if (memberships.length === 0) {
    return { memberships, active: null, unknownRestaurant: Boolean(slug) };
  }

  const membership = slug ? memberships.find((m) => m.restaurant.slug === slug) : memberships[0];

  if (!membership) {
    return { memberships, active: null, unknownRestaurant: true };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select(
      "id, name, slug, description, logo_url, contact_email, contact_phone, address_line1, address_line2, city, region, country_code, application_status, operational_status, subscription_status, created_at",
    )
    .eq("id", membership.restaurantId)
    .maybeSingle();

  if (error || !data) {
    // The membership exists but RLS filtered the row or the row is missing.
    return { memberships, active: null, unknownRestaurant: false };
  }

  return {
    memberships,
    unknownRestaurant: false,
    active: {
      membership,
      restaurant: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        logoUrl: data.logo_url,
        contactEmail: data.contact_email,
        contactPhone: data.contact_phone,
        addressLine1: data.address_line1,
        addressLine2: data.address_line2,
        city: data.city,
        region: data.region,
        countryCode: data.country_code,
        applicationStatus: data.application_status,
        operationalStatus: data.operational_status,
        subscriptionStatus: data.subscription_status,
        createdAt: data.created_at,
      },
    },
  };
}

/** Staff roster for the restaurant, including active and deactivated rows. */
export async function getStaffForRestaurant(restaurantId: string): Promise<StaffMemberSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_members")
    .select(
      "id, user_id, role, is_active, created_at, profiles!restaurant_members_user_id_fkey(full_name)",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as {
      full_name: string | null;
    } | null;

    return {
      memberId: row.id,
      userId: row.user_id,
      role: row.role,
      isActive: row.is_active,
      fullName: profile?.full_name ?? null,
      memberSince: row.created_at,
    };
  });
}

/** Pending + recent invitations for the restaurant (hash never selected). */
export async function getInvitationsForRestaurant(
  restaurantId: string,
): Promise<StaffInvitationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_staff_invitations")
    .select(
      "id, restaurant_id, email, role, status, invited_by, accepted_user_id, accepted_at, expires_at, created_at, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error || !data) {
    return [];
  }

  // The column privilege grant deliberately excludes token_hash.
  return data;
}

/** Simple buckets for the dashboard staff overview. */
export function summarizeStaff(members: StaffMemberSummary[]) {
  const active = members.filter((member) => member.isActive);

  return {
    total: members.length,
    active: active.length,
    admins: active.filter((member) => member.role === "restaurant_admin").length,
    waiters: active.filter((member) => member.role === "waiter").length,
    kitchen: active.filter((member) => member.role === "kitchen").length,
  };
}

export interface WorkspaceContext {
  user: { id: string; email: string | null };
  memberships: Membership[];
  restaurant: ActiveRestaurant["restaurant"];
  membership: Membership;
}

/** Membership list shaped for the workspace shell's switcher. */
export function toShellMemberships(memberships: readonly Membership[]) {
  return memberships.map((membership) => ({
    restaurantId: membership.restaurantId,
    slug: membership.restaurant.slug,
    name: membership.restaurant.name,
    role: membership.role,
  }));
}

export type WorkspaceSearchParams = Promise<{ restaurant?: string }>;

/**
 * Guard + load for the admin workspace. Redirects unauthenticated users to
 * login, non-admin members to their own console, and renders 404 for a slug
 * that does not belong to the caller. Returns the active restaurant context.
 */
export async function requireWorkspace(
  searchParams: WorkspaceSearchParams,
  returnTo: string,
): Promise<WorkspaceContext> {
  const { restaurant: slugParam } = await searchParams;
  const slug = slugParam && slugParam.length > 0 ? slugParam : undefined;

  const user = await requireUser(returnTo);
  const workspace = await getRestaurantWorkspace(user.id, slug);

  if (workspace.memberships.length === 0) {
    const [waiter, kitchen] = await Promise.all([
      membershipsWithRole(user.id, ["waiter"]),
      membershipsWithRole(user.id, ["kitchen"]),
    ]);
    redirect(waiter.length > 0 ? "/waiter" : kitchen.length > 0 ? "/kitchen" : "/restaurant/apply");
  }

  if (workspace.unknownRestaurant || !workspace.active) {
    // Either the slug does not exist, or it belongs to someone else. 404 for both.
    notFound();
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    memberships: workspace.memberships,
    restaurant: workspace.active.restaurant,
    membership: workspace.active.membership,
  };
}
