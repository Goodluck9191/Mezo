import { z } from "zod";

import { RESTAURANT_ROLES, ROLES } from "@/lib/security/roles";

/**
 * Validates a role received from an untrusted boundary (invitation form,
 * server action, route handler). Never trust a role from client input: the
 * server must look up the caller's membership instead of accepting it.
 */
export const roleSchema = z.enum(ROLES);

/**
 * Roles that can be assigned inside a restaurant. Platform administrators
 * are provisioned separately and cannot be created through restaurant flows.
 */
export const restaurantRoleSchema = z.enum(RESTAURANT_ROLES);

export type RoleInput = z.infer<typeof roleSchema>;
export type RestaurantRoleInput = z.infer<typeof restaurantRoleSchema>;
