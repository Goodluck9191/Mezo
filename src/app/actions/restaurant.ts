"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/validation/auth";

import { getServerEnv } from "@/lib/env/server";
import { isRestaurantAdminOf, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  invitationActionSchema,
  invitationTokenSchema,
  inviteStaffSchema,
  logoUploadConfirmSchema,
  logoUploadRequestSchema,
  membershipActionSchema,
  updateRestaurantProfileSchema,
} from "@/lib/validation/restaurant";

function firstParam(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function zodFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(error.flatten().fieldErrors)) {
    if (value && value.length > 0) {
      fieldErrors[key] = value;
    }
  }
  return fieldErrors;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

async function requireActiveUser() {
  const user = await requireUser("/restaurant/dashboard");
  return user;
}

function revalidateRestaurantWorkspace() {
  revalidatePath("/restaurant/dashboard", "page");
  revalidatePath("/restaurant/onboarding", "page");
  revalidatePath("/restaurant/settings", "page");
  revalidatePath("/restaurant/settings/profile", "page");
  revalidatePath("/restaurant/settings/staff", "page");
}

/**
 * Updates the restaurant's owner-editable profile fields. The restaurant id
 * comes from a hidden field but is never trusted: the caller must be an
 * active restaurant_admin of that restaurant. Platform-controlled columns
 * (approval, operational and subscription state) are not in the payload and
 * are additionally protected by the `restaurants_protect_review_fields`
 * trigger in Postgres.
 */
export async function updateRestaurantProfileAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateRestaurantProfileSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    name: firstParam(formData, "name"),
    description: firstParam(formData, "description") || null,
    logoUrl: firstParam(formData, "logoUrl") || null,
    contactEmail: firstParam(formData, "contactEmail") || null,
    contactPhone: firstParam(formData, "contactPhone") || null,
    addressLine1: firstParam(formData, "addressLine1") || null,
    addressLine2: firstParam(formData, "addressLine2") || null,
    city: firstParam(formData, "city") || null,
    region: firstParam(formData, "region") || null,
    countryCode: firstParam(formData, "countryCode") || "TZ",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const user = await requireActiveUser();

  if (!(await isRestaurantAdminOf(user.id, parsed.data.restaurantId))) {
    return { ok: false, error: "You do not administer this restaurant." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurants")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      logo_url: parsed.data.logoUrl ?? null,
      contact_email: parsed.data.contactEmail ?? null,
      contact_phone: parsed.data.contactPhone ?? null,
      address_line1: parsed.data.addressLine1 ?? null,
      address_line2: parsed.data.addressLine2 ?? null,
      city: parsed.data.city ?? null,
      region: parsed.data.region ?? null,
      country_code: parsed.data.countryCode,
    })
    .eq("id", parsed.data.restaurantId);

  if (error) {
    return { ok: false, error: "Could not save the profile. Please try again." };
  }

  revalidateRestaurantWorkspace();
  return { ok: true, message: "Profile saved." };
}

const LOGO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type LogoUploadResult =
  { ok: true; path: string; token: string } | { ok: false; error: string };

/**
 * Validates a prospective logo upload and mints a short-lived signed upload
 * URL for it. The actual file bytes never pass through this server: the
 * browser uploads straight to Supabase Storage, which enforces the bucket's
 * size and MIME limits, and the storage RLS policy only allows the folder of
 * the restaurant the caller administers.
 */
export async function requestLogoUploadAction(
  _prevState: unknown,
  formData: FormData,
): Promise<LogoUploadResult> {
  const parsed = logoUploadRequestSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    fileName: firstParam(formData, "fileName"),
    contentType: firstParam(formData, "contentType"),
    sizeBytes: firstParam(formData, "sizeBytes"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "That file cannot be used as a logo.";
    return { ok: false, error: message };
  }

  const user = await requireActiveUser();

  if (!(await isRestaurantAdminOf(user.id, parsed.data.restaurantId))) {
    return { ok: false, error: "You do not administer this restaurant." };
  }

  const extension = LOGO_EXTENSIONS[parsed.data.contentType];

  if (!extension) {
    return { ok: false, error: "Logo must be a PNG, JPEG, WebP or AVIF image." };
  }

  const path = `${parsed.data.restaurantId}/${crypto.randomUUID()}-logo.${extension}`;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("restaurant-logos")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, error: "Could not start the upload. Please try again." };
  }

  return { ok: true, path: data.path, token: data.token };
}

/**
 * Point the restaurant's logo at a storage path that was uploaded through a
 * signed URL for this restaurant. The path must start with the restaurant's
 * own id — otherwise one tenant could reference another's object names.
 */
export async function confirmLogoUploadAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionResult & { logoUrl?: string }> {
  const parsed = logoUploadConfirmSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    path: firstParam(formData, "path"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Unexpected logo reference." };
  }

  const user = await requireActiveUser();

  if (!(await isRestaurantAdminOf(user.id, parsed.data.restaurantId))) {
    return { ok: false, error: "You do not administer this restaurant." };
  }

  if (!parsed.data.path.startsWith(`${parsed.data.restaurantId}/`)) {
    return { ok: false, error: "Unexpected logo reference." };
  }

  const baseUrl = getServerEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const logoUrl = `${baseUrl}/storage/v1/object/public/restaurant-logos/${parsed.data.path}`;

  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurants")
    .update({ logo_url: logoUrl })
    .eq("id", parsed.data.restaurantId);

  if (error) {
    return { ok: false, error: "Could not update the logo. Please try again." };
  }

  revalidateRestaurantWorkspace();
  return { ok: true, message: "Logo updated.", logoUrl };
}

export type InviteStaffResult =
  | {
      ok: true;
      message: string;
      invite: {
        email: string;
        role: "waiter" | "kitchen";
        token: string;
        expiresAt: string;
      };
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Creates a single-use invitation for a waiter or kitchen role. The token is
 * returned to the calling administrator exactly once; they are responsible
 * for delivering it out of band. No e-mail is sent, and the token is stored
 * only as a salted hash.
 */
export async function inviteStaffAction(
  _prevState: InviteStaffResult | undefined,
  formData: FormData,
): Promise<InviteStaffResult> {
  const parsed = inviteStaffSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    email: firstParam(formData, "email"),
    role: firstParam(formData, "role"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const user = await requireActiveUser();

  if (!(await isRestaurantAdminOf(user.id, parsed.data.restaurantId))) {
    return { ok: false, error: "Only a restaurant administrator can invite staff." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_restaurant_staff", {
    p_restaurant_id: parsed.data.restaurantId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });

  if (error) {
    if (error.code === "23505" || /already exists/i.test(error.message)) {
      return {
        ok: false,
        error: "A pending invitation already exists for this email and role.",
      };
    }

    return { ok: false, error: "Could not create the invitation. Please try again." };
  }

  const invitation = data?.[0];

  if (!invitation) {
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/restaurant/settings/staff", "page");
  return {
    ok: true,
    message: "Invitation created. Share the one-time link below.",
    invite: {
      email: invitation.email,
      role: invitation.role === "kitchen" ? "kitchen" : "waiter",
      token: invitation.token,
      expiresAt: invitation.expires_at,
    },
  };
}

/** Revokes a pending invitation for the caller's restaurant. */
export async function revokeInvitationAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = invitationActionSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    invitationId: firstParam(formData, "invitationId"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Missing invitation reference." };
  }

  const user = await requireActiveUser();

  if (!(await isRestaurantAdminOf(user.id, parsed.data.restaurantId))) {
    return { ok: false, error: "Only a restaurant administrator can revoke invitations." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_restaurant_invitation", {
    p_invitation_id: parsed.data.invitationId,
  });

  if (error) {
    return { ok: false, error: "Could not revoke the invitation. It may already be used." };
  }

  revalidatePath("/restaurant/settings/staff", "page");
  return { ok: true, message: "Invitation revoked." };
}

/** Soft-deactivates a member of the caller's restaurant. */
export async function deactivateMemberAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = membershipActionSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    memberId: firstParam(formData, "memberId"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Missing member reference." };
  }

  const user = await requireActiveUser();

  if (!(await isRestaurantAdminOf(user.id, parsed.data.restaurantId))) {
    return { ok: false, error: "Only a restaurant administrator can deactivate staff." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deactivate_restaurant_member", {
    p_member_id: parsed.data.memberId,
  });

  if (error) {
    if (/only restaurant_admin/i.test(error.message)) {
      return { ok: false, error: "Only a restaurant administrator can deactivate staff." };
    }

    if (/own membership|last active restaurant_admin/i.test(error.message)) {
      return { ok: false, error: error.message };
    }

    return { ok: false, error: "Could not deactivate the member. Please try again." };
  }

  const affected = data;

  if (!affected) {
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/restaurant/settings/staff", "page");
  revalidatePath("/restaurant/dashboard", "page");
  return { ok: true, message: "Member deactivated." };
}

export type AcceptInvitationResult = ActionResult;

/**
 * Accepts a single-use staff invitation for the signed-in user. The
 * invitation email must match the account email; anonymous accounts have no
 * email and cannot accept. On success the user is sent to their role's
 * console.
 */
export async function acceptStaffInvitationAction(
  _prevState: AcceptInvitationResult | undefined,
  formData: FormData,
): Promise<AcceptInvitationResult> {
  const parsed = invitationTokenSchema.safeParse(firstParam(formData, "token"));

  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter the full invitation code you received (64 hexadecimal characters).",
    };
  }

  await requireUser(`/accept-invite?token=${encodeURIComponent(parsed.data)}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_restaurant_invitation", {
    p_token: parsed.data,
  });

  if (error) {
    const message = /addressed to a different email/i.test(error.message)
      ? "This invitation was issued for a different email address."
      : /authentication required/i.test(error.message)
        ? "Your session expired. Sign in again."
        : "This invitation is invalid, expired or already used.";

    return { ok: false, error: message };
  }

  const accepted = data?.[0];

  if (!accepted) {
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/restaurant/dashboard", "page");
  redirect(accepted.role === "kitchen" ? "/kitchen" : "/waiter");
}
