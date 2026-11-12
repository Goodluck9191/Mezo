import { z } from "zod";

/** Integer TZS amount — bigint-safe values only. */
const tzsAmount = z.coerce
  .number()
  .int("Amount must be a whole number of shillings.")
  .min(0, "Amount cannot be negative.")
  .max(Number.MAX_SAFE_INTEGER, "Amount is too large.");

/** Optional date string (YYYY-MM-DD), passed through to the database. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date as YYYY-MM-DD.")
  .or(z.literal(""))
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const createSubscriptionPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Code must be at least 3 characters.")
    .max(40, "Code must be 40 characters or fewer.")
    .regex(/^[a-z0-9_]{3,40}$/, "Lowercase letters, numbers and underscores only."),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name is too long."),
  description: z.string().trim().max(1000, "Description is too long.").nullable().optional(),
  priceTzs: tzsAmount,
  billingInterval: z.enum(["monthly", "yearly"], {
    message: "Choose monthly or yearly billing.",
  }),
  tableLimit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1.")
    .max(10_000, "Limit must be 10,000 or fewer."),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
});

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>;

export const updateSubscriptionPlanSchema = z.object({
  planId: z.uuid("Invalid plan reference."),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name is too long."),
  description: z.string().trim().max(1000, "Description is too long.").nullable().optional(),
  priceTzs: tzsAmount,
  billingInterval: z.enum(["monthly", "yearly"], {
    message: "Choose monthly or yearly billing.",
  }),
  tableLimit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1.")
    .max(10_000, "Limit must be 10,000 or fewer."),
});

export type UpdateSubscriptionPlanInput = z.infer<typeof updateSubscriptionPlanSchema>;

export const setPlanActiveSchema = z.object({
  planId: z.uuid("Invalid plan reference."),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type SetPlanActiveInput = z.infer<typeof setPlanActiveSchema>;

export const assignPlanSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  planId: z.uuid("Invalid plan reference."),
  startsOn: isoDate,
  renewsOn: isoDate,
});

export type AssignPlanInput = z.infer<typeof assignPlanSchema>;

export const subscriptionStatusSchema = z.enum(["active", "past_due", "expired", "cancelled"], {
  message: "Unsupported status.",
});

export const setSubscriptionStatusSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  status: subscriptionStatusSchema,
});

export type SetSubscriptionStatusInput = z.infer<typeof setSubscriptionStatusSchema>;

export const paymentStatusSchema = z.enum(
  ["pending", "processing", "successful", "failed", "cancelled", "refunded"],
  { message: "Unsupported payment status." },
);

export const recordPaymentSchema = z
  .object({
    restaurantId: z.uuid("Invalid restaurant reference."),
    amountTzs: tzsAmount,
    status: paymentStatusSchema,
    providerReference: z
      .string()
      .trim()
      .max(120, "Reference is too long.")
      .refine((value) => value === "" || /^[A-Za-z0-9._:\-]{4,120}$/.test(value), {
        message: "Use 4–120 letters, numbers, dots, hyphens or colons.",
      })
      .optional(),
    periodStartsOn: isoDate,
    periodEndsOn: isoDate,
    failureReason: z.string().trim().max(500, "Reason is too long.").optional(),
  })
  .refine(
    (value) =>
      !value.periodStartsOn || !value.periodEndsOn || value.periodEndsOn >= value.periodStartsOn,
    { message: "Period end must be on or after period start.", path: ["periodEndsOn"] },
  );

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
