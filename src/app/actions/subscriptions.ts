"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/validation/auth";

import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  assignPlanSchema,
  createSubscriptionPlanSchema,
  setPlanActiveSchema,
  setSubscriptionStatusSchema,
  recordPaymentSchema,
  updateSubscriptionPlanSchema,
} from "@/lib/validation/subscription";

/** Expire every overdue subscription (renewal date has passed). Platform admins only. */
export async function expireOverdueSubscriptionsAction(
  _prevState: ActionResult | undefined,
  _formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin("/platform/subscriptions");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("expire_overdue_subscriptions");

  if (error) {
    return { ok: false, error: "Could not expire the overdue subscriptions. Please try again." };
  }

  const expired = Number(data ?? 0);
  revalidatePlatform();
  return {
    ok: true,
    message:
      expired === 0
        ? "No overdue subscriptions found."
        : `${expired} subscription${expired === 1 ? "" : "s"} expired.`,
  };
}

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

function revalidatePlatform() {
  revalidatePath("/platform/subscriptions", "page");
  revalidatePath("/platform/plans", "page");
  revalidatePath("/platform/subscriptions/[id]", "page");
  revalidatePath("/restaurant/dashboard", "page");
  revalidatePath("/restaurant/billing", "page");
}

/** Create a catalogue plan. Platform admins only. */
export async function createSubscriptionPlanAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin("/platform/plans");

  const parsed = createSubscriptionPlanSchema.safeParse({
    code: firstParam(formData, "code"),
    name: firstParam(formData, "name"),
    description: firstParam(formData, "description") || null,
    priceTzs: firstParam(formData, "priceTzs"),
    billingInterval: firstParam(formData, "billingInterval"),
    tableLimit: firstParam(formData, "tableLimit"),
    isActive: firstParam(formData, "isActive") || "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_subscription_plan", {
    p_code: parsed.data.code,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
    p_price_tzs: BigInt(parsed.data.priceTzs) as unknown as number,
    p_billing_interval: parsed.data.billingInterval,
    p_table_limit: parsed.data.tableLimit,
    p_is_active: parsed.data.isActive,
  });

  if (error) {
    if (error.code === "23505" || /duplicate/i.test(error.message)) {
      return { ok: false, error: "A plan with that code already exists." };
    }

    return { ok: false, error: "Could not create the plan. Please try again." };
  }

  revalidatePlatform();
  return { ok: true, message: "Plan created." };
}

/** Update a catalogue plan. Platform admins only. */
export async function updateSubscriptionPlanAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin("/platform/plans");

  const parsed = updateSubscriptionPlanSchema.safeParse({
    planId: firstParam(formData, "planId"),
    name: firstParam(formData, "name"),
    description: firstParam(formData, "description") || null,
    priceTzs: firstParam(formData, "priceTzs"),
    billingInterval: firstParam(formData, "billingInterval"),
    tableLimit: firstParam(formData, "tableLimit"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_subscription_plan", {
    p_plan_id: parsed.data.planId,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
    p_price_tzs: BigInt(parsed.data.priceTzs) as unknown as number,
    p_billing_interval: parsed.data.billingInterval,
    p_table_limit: parsed.data.tableLimit,
  });

  if (error) {
    return { ok: false, error: "Could not update the plan. Please try again." };
  }

  revalidatePlatform();
  return { ok: true, message: "Plan saved. The new table limit applies to new assignments only." };
}

/** Activate or deactivate a catalogue plan. Platform admins only. */
export async function setPlanActiveAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin("/platform/plans");

  const parsed = setPlanActiveSchema.safeParse({
    planId: firstParam(formData, "planId"),
    isActive: firstParam(formData, "isActive"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Invalid plan reference." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_subscription_plan_active", {
    p_plan_id: parsed.data.planId,
    p_is_active: parsed.data.isActive,
  });

  if (error) {
    return { ok: false, error: "Could not update the plan. Please try again." };
  }

  revalidatePlatform();
  return {
    ok: true,
    message: parsed.data.isActive
      ? "Plan activated."
      : "Plan deactivated. Hidden from the public catalogue.",
  };
}

/** Assign a plan to a restaurant, closing the current term. Platform admins only. */
export async function assignSubscriptionPlanAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin("/platform/subscriptions");

  const parsed = assignPlanSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    planId: firstParam(formData, "planId"),
    startsOn: firstParam(formData, "startsOn"),
    renewsOn: firstParam(formData, "renewsOn"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_subscription_plan", {
    p_restaurant_id: parsed.data.restaurantId,
    p_plan_id: parsed.data.planId,
    p_starts_on: parsed.data.startsOn ?? undefined,
    p_renews_on: parsed.data.renewsOn ?? undefined,
  });

  if (error) {
    if (/missing or inactive/i.test(error.message)) {
      return { ok: false, error: "That plan is missing or inactive." };
    }

    return { ok: false, error: "Could not assign the plan. Please try again." };
  }

  revalidatePlatform();
  redirect(`/platform/subscriptions/${parsed.data.restaurantId}`);
}

/** Move a subscription through the allowed lifecycle. Platform admins only. */
export async function setSubscriptionStatusAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin("/platform/subscriptions");

  const parsed = setSubscriptionStatusSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    status: firstParam(formData, "status"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Missing subscription reference." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_subscription_status", {
    p_restaurant_id: parsed.data.restaurantId,
    p_status: parsed.data.status,
  });

  if (error) {
    if (/invalid transition/i.test(error.message)) {
      return { ok: false, error: error.message };
    }

    if (/not found/i.test(error.message)) {
      return { ok: false, error: "No subscription exists for this restaurant." };
    }

    return { ok: false, error: "Could not change the status. Please try again." };
  }

  revalidatePlatform();
  redirect(`/platform/subscriptions/${parsed.data.restaurantId}`);
}

/** Record a subscription payment manually. Platform admins only. */
export async function recordSubscriptionPaymentAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin("/platform/subscriptions");

  const parsed = recordPaymentSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    amountTzs: firstParam(formData, "amountTzs"),
    status: firstParam(formData, "status"),
    providerReference: firstParam(formData, "providerReference"),
    periodStartsOn: firstParam(formData, "periodStartsOn"),
    periodEndsOn: firstParam(formData, "periodEndsOn"),
    failureReason: firstParam(formData, "failureReason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_subscription_payment", {
    p_restaurant_id: parsed.data.restaurantId,
    p_amount_tzs: BigInt(parsed.data.amountTzs) as unknown as number,
    p_status: parsed.data.status,
    p_provider_reference: parsed.data.providerReference || null,
    p_period_starts_on: parsed.data.periodStartsOn ?? undefined,
    p_period_ends_on: parsed.data.periodEndsOn ?? undefined,
    p_paid_at: undefined,
    p_failure_reason: parsed.data.failureReason || null,
  });

  if (error) {
    return { ok: false, error: "Could not record the payment. Please try again." };
  }

  revalidatePlatform();
  redirect(`/platform/subscriptions/${parsed.data.restaurantId}`);
}
