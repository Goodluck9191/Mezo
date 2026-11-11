import { z } from "zod";

const emailNormalized = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters.")
      .max(120, "Full name is too long."),
    email: emailNormalized,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password is too long.")
      .regex(/[a-zA-Z]/, "Password must contain a letter.")
      .regex(/[0-9]/, "Password must contain a number."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: emailNormalized,
  password: z.string().min(1, "Enter your password."),
});

export const requestPasswordResetSchema = z.object({
  email: emailNormalized,
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password is too long.")
      .regex(/[a-zA-Z]/, "Password must contain a letter.")
      .regex(/[0-9]/, "Password must contain a number."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(120, "Full name is too long."),
  avatarUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === "" || /^https:\/\//i.test(value), {
      message: "Avatar URL must start with https://.",
    })
    .nullable()
    .optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || /^\+?[0-9]{7,15}$/i.test(value), {
      message: "Enter a valid phone number, e.g. +255700000000.",
    })
    .nullable()
    .optional(),
});

export const applyForRestaurantSchema = z.object({
  name: z.string().trim().min(2, "Restaurant name must be at least 2 characters.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug must be at least 2 characters.")
    .max(40)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug may only contain lowercase letters, numbers and hyphens.",
    ),
  description: z.string().trim().max(2000).nullable().optional(),
  contactEmail: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/i, "Enter a valid phone number, e.g. +255700000000.")
    .or(z.literal("")),
  city: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  message: z.string().trim().max(2000).optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ApplyForRestaurantInput = z.infer<typeof applyForRestaurantSchema>;

/**
 * Result of a server action. Actions never throw for expected failures; they
 * return this structure so forms can render friendly, non-leaky errors.
 */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Maps Supabase auth error codes to user-safe messages. */
export function friendlyAuthError(
  error: { message: string; code?: string } | null,
  fallback = "Something went wrong. Please try again.",
): string {
  const message = error?.message ?? "";
  const code = error?.code ?? "";

  if (/invalid login credentials/i.test(message) || code === "invalid_credentials") {
    return "Email or password is incorrect.";
  }
  if (
    /email not confirmed/i.test(message) ||
    code === "email_not_confirmed" ||
    code === "user_not_confirmed"
  ) {
    return "Please confirm your email before signing in. Check your inbox for the verification link.";
  }
  if (/user already registered/i.test(message) || code === "user_already_exists") {
    return "An account already exists for this email. Sign in instead.";
  }
  if (/password should be at least/i.test(message)) {
    return "Password is too weak. Use at least 8 characters.";
  }
  if (
    /rate limit/i.test(message) ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (/token has expired|invalid.*token/i.test(message) || code === "otp_expired") {
    return "That link has expired or is invalid. Request a new one.";
  }
  return fallback;
}
