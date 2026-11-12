import { z } from "zod";

const emailNormalized = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const phoneValue = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/i, "Enter a valid phone number, e.g. +255700000000.")
  .or(z.literal(""));

/** Owner-editable profile fields. Platform-controlled columns are absent by design. */
export const updateRestaurantProfileSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  name: z
    .string()
    .trim()
    .min(2, "Restaurant name must be at least 2 characters.")
    .max(120, "Restaurant name is too long."),
  description: optionalText(2000),
  logoUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === "" || /^https:\/\//i.test(value), {
      message: "Logo URL must start with https://.",
    })
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(320)
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Enter a valid email address.",
    })
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  contactPhone: phoneValue
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(80),
  region: optionalText(80),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "Use a two-letter country code, e.g. TZ.")
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code, e.g. TZ."),
});

export type UpdateRestaurantProfileInput = z.infer<typeof updateRestaurantProfileSchema>;

/** Payload for requesting a signed upload URL for the restaurant logo. */
export const logoUploadRequestSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/avif"], {
    message: "Logo must be a PNG, JPEG, WebP or AVIF image.",
  }),
  sizeBytes: z.coerce
    .number()
    .int()
    .positive("Choose a file to upload.")
    .max(2 * 1024 * 1024, "Logo must be 2 MB or smaller."),
});

export type LogoUploadRequestInput = z.infer<typeof logoUploadRequestSchema>;

/** Confirm (or roll back) a completed logo upload. */
export const logoUploadConfirmSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  path: z
    .string()
    .trim()
    .min(3)
    .max(512)
    .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}-[a-z0-9.-]+$/i, "Unexpected storage path for the logo."),
});

export type LogoUploadConfirmInput = z.infer<typeof logoUploadConfirmSchema>;

export const inviteStaffSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  email: emailNormalized,
  role: z.enum(["waiter", "kitchen"]).refine((value) => value === "waiter" || value === "kitchen", {
    message: "Invitees can only be given a waiter or kitchen role.",
  }),
});

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const invitationTokenSchema = z
  .string()
  .trim()
  .min(32, "Invitation token is too short.")
  .max(128, "Invitation token is too long.")
  .regex(/^[a-f0-9]+$/i, "Invitation token is malformed.");

export const membershipActionSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  memberId: z.uuid("Invalid membership reference."),
});

export const invitationActionSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  invitationId: z.uuid("Invalid invitation reference."),
});
