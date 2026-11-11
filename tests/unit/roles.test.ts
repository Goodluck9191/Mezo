import { describe, expect, it } from "vitest";

import {
  hasPermission,
  isPlatformAdmin,
  isRestaurantRole,
  isRole,
  PERMISSIONS,
  RESTAURANT_ROLES,
  ROLE_PERMISSIONS,
  ROLES,
} from "@/lib/security/roles";
import { restaurantRoleSchema, roleSchema } from "@/lib/validation/roles";

describe("role definitions", () => {
  it("defines exactly the four supported roles", () => {
    expect([...ROLES]).toEqual(["platform_admin", "restaurant_admin", "waiter", "kitchen"]);
  });

  it("no longer exposes owner or manager", () => {
    expect(isRole("owner")).toBe(false);
    expect(isRole("manager")).toBe(false);
    expect(roleSchema.safeParse("owner").success).toBe(false);
    expect(roleSchema.safeParse("manager").success).toBe(false);
  });

  it("only treats the three restaurant roles as tenant-scoped", () => {
    expect([...RESTAURANT_ROLES]).toEqual(["restaurant_admin", "waiter", "kitchen"]);
    expect(isRestaurantRole("platform_admin")).toBe(false);
    expect(isPlatformAdmin("platform_admin")).toBe(true);
    expect(isPlatformAdmin("restaurant_admin")).toBe(false);
  });
});

describe("roleSchema", () => {
  it.each(["platform_admin", "restaurant_admin", "waiter", "kitchen"])("accepts %s", (role) => {
    expect(roleSchema.safeParse(role).success).toBe(true);
  });

  it("rejects unknown roles", () => {
    expect(roleSchema.safeParse("super_admin").success).toBe(false);
    expect(roleSchema.safeParse("").success).toBe(false);
  });
});

describe("restaurantRoleSchema", () => {
  it("rejects platform_admin for restaurant membership", () => {
    expect(restaurantRoleSchema.safeParse("platform_admin").success).toBe(false);
  });

  it("accepts the restaurant roles", () => {
    expect(restaurantRoleSchema.safeParse("restaurant_admin").success).toBe(true);
    expect(restaurantRoleSchema.safeParse("waiter").success).toBe(true);
    expect(restaurantRoleSchema.safeParse("kitchen").success).toBe(true);
  });
});

describe("permission matrix", () => {
  const platformPermissions = ["applications.review", "restaurants.suspend", "plans.manage"];

  it("only grants platform permissions to platform_admin", () => {
    for (const role of ROLES) {
      for (const permission of platformPermissions) {
        const expected = role === "platform_admin";
        expect(hasPermission(role, permission as (typeof PERMISSIONS)[number])).toBe(expected);
      }
    }
  });

  it("does not give restaurant_admin any platform permission", () => {
    for (const permission of platformPermissions) {
      expect(hasPermission("restaurant_admin", permission as (typeof PERMISSIONS)[number])).toBe(
        false,
      );
    }
  });

  it("does not give platform_admin restaurant data permissions", () => {
    expect(hasPermission("platform_admin", "restaurant.menu.manage")).toBe(false);
    expect(hasPermission("platform_admin", "orders.manage")).toBe(false);
    expect(hasPermission("platform_admin", "reports.read")).toBe(false);
  });

  it("gives restaurant_admin full restaurant administration", () => {
    const permissions = [
      "restaurant.settings.manage",
      "restaurant.menu.manage",
      "restaurant.tables.manage",
      "restaurant.staff.manage",
      "restaurant.subscription.manage",
      "orders.read",
      "orders.manage",
      "reports.read",
    ] as const;

    for (const permission of permissions) {
      expect(hasPermission("restaurant_admin", permission)).toBe(true);
    }
  });

  it("keeps waiter permissions restricted", () => {
    expect(hasPermission("waiter", "table_sessions.open")).toBe(true);
    expect(hasPermission("waiter", "table_sessions.close")).toBe(true);
    expect(hasPermission("waiter", "orders.read")).toBe(true);
    expect(hasPermission("waiter", "restaurant.staff.manage")).toBe(false);
    expect(hasPermission("waiter", "restaurant.menu.manage")).toBe(false);
    expect(hasPermission("waiter", "reports.read")).toBe(false);
  });

  it("keeps kitchen permissions restricted", () => {
    expect(hasPermission("kitchen", "orders.read")).toBe(true);
    expect(hasPermission("kitchen", "orders.prepare")).toBe(true);
    expect(hasPermission("kitchen", "orders.manage")).toBe(false);
    expect(hasPermission("kitchen", "table_sessions.open")).toBe(false);
    expect(hasPermission("kitchen", "restaurant.menu.manage")).toBe(false);
  });

  it("never references an undefined permission", () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });
});
