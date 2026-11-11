"use server";

import { redirect } from "next/navigation";

import { getServerEnv } from "@/lib/env/server";
import {
  applyForRestaurantSchema,
  friendlyAuthError,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
  type ActionResult,
} from "@/lib/validation/auth";
import { isPlatformAdmin, membershipsWithRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

type State = ActionResult | undefined;

function firstParam(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (/[\r\n\\]/.test(next)) return null;
  return next;
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

export async function resendConfirmationEmail(
  _prevState: State,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: firstParam(formData, "email"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Enter the email you signed up with." };
  }

  const supabase = await createClient();
  await supabase.auth.resend({ type: "signup", email: parsed.data.email });

  // Same non-leaky response either way.
  return { ok: true, message: "If that account exists, we sent a new verification link." };
}

function appUrl(): string {
  return getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

/**
 * Where to send a freshly signed-in user. Platform admins land on the
 * platform console; restaurant staff land on their strongest role's console.
 */
async function defaultLanding(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "/login";
  }

  if (await isPlatformAdmin()) {
    return "/platform";
  }

  const memberships = await membershipsWithRole(user.id, ["restaurant_admin", "waiter", "kitchen"]);

  const top = memberships[0];
  if (top) {
    if (top.role === "restaurant_admin") return "/restaurant/dashboard";
    if (top.role === "waiter") return "/waiter";
    if (top.role === "kitchen") return "/kitchen";
  }

  // Signed in but no role yet: send to the onboarding entry point.
  return "/restaurant/apply";
}

export async function signUp(_prevState: State, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    fullName: firstParam(formData, "fullName"),
    email: firstParam(formData, "email"),
    password: firstParam(formData, "password"),
    confirmPassword: firstParam(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/confirm`,
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    return {
      ok: false,
      error: friendlyAuthError(error, "Could not create your account. Please try again."),
    };
  }

  redirect("/verify-email");
}

export async function signIn(_prevState: State, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: firstParam(formData, "email"),
    password: firstParam(formData, "password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      ok: false,
      error: friendlyAuthError(error, "Could not sign you in right now. Please try again."),
    };
  }

  const explicitNext = safeNextPath(formData.get("next"));
  if (explicitNext) {
    redirect(explicitNext);
  }

  redirect(await defaultLanding());
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // Sign out of the server-side session and clear local cookies via the proxy.
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prevState: State,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: firstParam(formData, "email"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  // Deliberately identical response whether the account exists or not.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl()}/auth/confirm?next=/reset-password`,
  });

  return { ok: true, message: "If an account exists for that email, we sent reset instructions." };
}

export async function updatePassword(_prevState: State, formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: firstParam(formData, "password"),
    confirmPassword: firstParam(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      ok: false,
      error: friendlyAuthError(error, "Could not update your password. Try the reset link again."),
    };
  }

  return { ok: true, message: "Password updated. You can now sign in." };
}

export async function updateProfile(_prevState: State, formData: FormData): Promise<ActionResult> {
  const parsed = updateProfileSchema.safeParse({
    fullName: firstParam(formData, "fullName"),
    avatarUrl: firstParam(formData, "avatarUrl") || null,
    phone: firstParam(formData, "phone") || null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Your session expired. Sign in again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      avatar_url: parsed.data.avatarUrl ?? null,
      phone: parsed.data.phone ?? null,
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: "Could not save your profile. Please try again." };
  }

  return { ok: true, message: "Profile updated." };
}

export async function applyForRestaurantAction(
  _prevState: State,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = applyForRestaurantSchema.safeParse({
    name: firstParam(formData, "name"),
    slug: firstParam(formData, "slug"),
    description: firstParam(formData, "description") || undefined,
    contactEmail: firstParam(formData, "contactEmail"),
    contactPhone: firstParam(formData, "contactPhone") || "",
    city: firstParam(formData, "city") || undefined,
    region: firstParam(formData, "region") || undefined,
    message: firstParam(formData, "message") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_for_restaurant", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_description: parsed.data.description ?? null,
    p_contact_email: parsed.data.contactEmail,
    p_contact_phone: parsed.data.contactPhone,
    p_address_line1: null,
    p_address_line2: null,
    p_city: parsed.data.city ?? null,
    p_region: parsed.data.region ?? null,
    p_message: parsed.data.message ?? null,
  });

  if (error) {
    const message = /already have a pending application/i.test(error.message)
      ? "You already have a pending application. Track its status below."
      : friendlyAuthError(error, "Could not submit your application. Please try again.");
    return { ok: false, error: message };
  }

  return { ok: true, message: "Application submitted. We will review it shortly." };
}

export async function reviewApplicationAction(
  _prevState: State,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isPlatformAdmin())) {
    return { ok: false, error: "Only platform administrators can review applications." };
  }

  const decision = firstParam(formData, "decision");
  const plan = firstParam(formData, "plan");
  const reason = firstParam(formData, "reason");

  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false, error: "Choose approve or reject." };
  }

  if (decision === "approved") {
    if (!plan) {
      return { ok: false, error: "Select a subscription plan to approve." };
    }
  } else if (reason.trim().length < 4) {
    return { ok: false, error: "A rejection reason of at least 4 characters is required." };
  }

  // Already validated above by narrow checks; the schema is deliberately
  // small and inline to keep the client payload honest.
  const isApprove = decision === "approved";

  const supabase = await createClient();
  const applicationId = firstParam(formData, "applicationId");
  if (!applicationId) {
    return { ok: false, error: "Missing application reference." };
  }

  if (isApprove) {
    const { error } = await supabase.rpc("review_restaurant_application", {
      p_application_id: applicationId,
      p_decision: "approved",
      p_plan_id: plan,
      p_reason: null,
    });

    if (error) {
      return {
        ok: false,
        error: "Could not approve this application. It may have been reviewed already.",
      };
    }

    return {
      ok: true,
      message: "Application approved. The registrant is now the restaurant admin.",
    };
  }

  const { error } = await supabase.rpc("review_restaurant_application", {
    p_application_id: applicationId,
    p_decision: "rejected",
    p_plan_id: null,
    p_reason: reason,
  });

  if (error) {
    return {
      ok: false,
      error: "Could not reject this application. It may have been reviewed already.",
    };
  }

  return { ok: true, message: "Application rejected." };
}
