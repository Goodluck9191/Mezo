/**
 * Canonical role definitions.
 *
 * These values must stay in sync with the `restaurant_role` / membership
 * enums that Phase 2 will add to Postgres. They are a single source of truth
 * for UI labels, server-side guards, and validation schemas.
 *
 * Authorization is still enforced by Row Level Security. Anything in this
 * module is a convenience layer: it decides what to render and fails fast,
 * but it never replaces a policy.
 */

export const ROLES = ["platform_admin", "restaurant_admin", "waiter", "kitchen"] as const;

export type Role = (typeof ROLES)[number];

/**
 * Roles that belong to a restaurant tenant. A restaurant admin, waiter, or
 * kitchen member is always scoped to exactly one restaurant.
 */
export const RESTAURANT_ROLES = ["restaurant_admin", "waiter", "kitchen"] as const;

export type RestaurantRole = (typeof RESTAURANT_ROLES)[number];

export const ROLE_LABELS = {
  platform_admin: "Platform admin",
  restaurant_admin: "Restaurant admin",
  waiter: "Waiter",
  kitchen: "Kitchen",
} as const satisfies Record<Role, string>;

export const PERMISSIONS = [
  // Platform scope — reserved for platform administrators.
  "applications.review",
  "restaurants.suspend",
  "plans.manage",
  // Restaurant scope — restaurant administrators and, where noted, staff.
  "restaurant.settings.manage",
  "restaurant.menu.manage",
  "restaurant.tables.manage",
  "restaurant.staff.manage",
  "restaurant.subscription.manage",
  "orders.read",
  "orders.manage",
  "orders.prepare",
  "reports.read",
  // Floor scope — waiters control table sessions.
  "table_sessions.open",
  "table_sessions.close",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permission matrix. The lists are intentionally explicit so that a new
 * permission is never granted to a role by accident.
 */
export const ROLE_PERMISSIONS = {
  platform_admin: ["applications.review", "restaurants.suspend", "plans.manage"],
  restaurant_admin: [
    "restaurant.settings.manage",
    "restaurant.menu.manage",
    "restaurant.tables.manage",
    "restaurant.staff.manage",
    "restaurant.subscription.manage",
    "orders.read",
    "orders.manage",
    "reports.read",
    "table_sessions.open",
    "table_sessions.close",
  ],
  waiter: ["orders.read", "orders.manage", "table_sessions.open", "table_sessions.close"],
  kitchen: ["orders.read", "orders.prepare"],
} as const satisfies Record<Role, readonly Permission[]>;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isRestaurantRole(value: unknown): value is RestaurantRole {
  return typeof value === "string" && (RESTAURANT_ROLES as readonly string[]).includes(value);
}

export function isPlatformAdmin(value: unknown): boolean {
  return value === "platform_admin";
}

/**
 * Returns true only when the role holds the permission.
 * Platform permissions are never granted to a restaurant role.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
}
