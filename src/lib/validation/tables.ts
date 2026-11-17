import { z } from "zod";

/**
 * Validation for the Phase 7 table-access surfaces. Tokens are 64 lowercase
 * hex chars (two v4 UUIDs, ~244 bits) — never sequential ids. The stored side
 * holds only md5(token); these schemas validate the cleartext presented at the
 * boundary.
 */

export const qrTokenSchema = z.string().regex(/^[0-9a-f]{64}$/, "This table code is not valid.");

export const tableNameSchema = z
  .string()
  .trim()
  .min(1, "Give the table a name.")
  .max(40, "Keep the table name under 40 characters.")
  .regex(/^[^\r\n]*$/, "Table name must be a single line.");

export const uuidSchema = z.uuid("That identifier is not valid.");

export const createTableSchema = z.object({
  restaurantId: uuidSchema,
  name: tableNameSchema,
});

export const tableIdSchema = z.object({
  tableId: uuidSchema,
});

export const tableRequestIdSchema = z.object({
  requestId: uuidSchema,
});

export const tableSessionIdSchema = z.object({
  sessionId: uuidSchema,
});

export const partySizeSchema = z
  .number()
  .int()
  .min(1, "Party size must be at least 1.")
  .max(50, "Party size must be 50 or fewer.");

export type CreateTableInput = z.infer<typeof createTableSchema>;
