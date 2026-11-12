import "server-only";

import type { Database } from "@/types/database";

import { createClient } from "@/lib/supabase/server";
import {
  billingIntervalLabel,
  statusLabel,
  type SubscriptionStatus,
} from "@/lib/subscriptions-shared";

export type SubscriptionPlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];
export type RestaurantSubscriptionRow =
  Database["public"]["Tables"]["restaurant_subscriptions"]["Row"];
export type SubscriptionPaymentRow = Database["public"]["Tables"]["subscription_payments"]["Row"];

export interface PlanSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceTzs: number;
  billingInterval: string;
  billingIntervalLabel: string;
  tableLimit: number;
  isActive: boolean;
}

export interface SubscriptionSnapshot {
  id: string;
  status: SubscriptionStatus;
  statusLabel: string;
  tableLimit: number;
  usedTables: number;
  remainingTables: number;
  startsOn: string;
  renewsOn: string | null;
  expiresOn: string | null;
  cancelledAt: string | null;
  plan: PlanSummary;
}

function toNumber(value: bigint | number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toPlanSummary(row: SubscriptionPlanRow): PlanSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    priceTzs: toNumber(row.price_tzs),
    billingInterval: row.billing_interval,
    billingIntervalLabel: billingIntervalLabel(row.billing_interval),
    tableLimit: row.table_limit,
    isActive: row.is_active,
  };
}

function toSubscriptionStatus(value: string): SubscriptionStatus {
  switch (value) {
    case "pending":
    case "active":
    case "past_due":
    case "cancelled":
    case "expired":
      return value;
    default:
      return "past_due";
  }
}

function isCurrent(status: string): boolean {
  return status === "pending" || status === "active" || status === "past_due";
}

/**
 * The restaurant's current (or most recent) subscription plus table usage.
 * All reads run under the caller's RLS — the caller must belong to the
 * restaurant, or be a platform admin, to see anything.
 */
export async function getRestaurantSubscriptionView(restaurantId: string): Promise<{
  subscription: SubscriptionSnapshot | null;
  payments: Array<
    Pick<
      SubscriptionPaymentRow,
      | "id"
      | "amount_tzs"
      | "status"
      | "paid_at"
      | "period_starts_on"
      | "period_ends_on"
      | "provider_reference"
      | "created_at"
    >
  >;
}> {
  const supabase = await createClient();

  const [subscriptionRes, paymentsRes, tablesRes] = await Promise.all([
    supabase
      .from("restaurant_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("subscription_payments")
      .select(
        "id, amount_tzs, status, paid_at, period_starts_on, period_ends_on, provider_reference, created_at",
      )
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("restaurant_tables").select("id").eq("restaurant_id", restaurantId),
  ]);

  const rows = (subscriptionRes.data ?? []) as unknown as Array<
    RestaurantSubscriptionRow & { plan: SubscriptionPlanRow | null }
  >;
  const used = tablesRes.data?.length ?? 0;
  const current = rows.find((row) => isCurrent(row.status)) ?? rows[0] ?? null;

  const subscription = current?.plan
    ? {
        id: current.id,
        status: toSubscriptionStatus(current.status),
        statusLabel: statusLabel(toSubscriptionStatus(current.status)),
        tableLimit: current.table_limit,
        usedTables: used,
        remainingTables: Math.max(current.table_limit - used, 0),
        startsOn: current.starts_on,
        renewsOn: current.renews_on,
        expiresOn: current.expires_on,
        cancelledAt: current.cancelled_at,
        plan: toPlanSummary(current.plan),
      }
    : null;

  return {
    subscription,
    payments: (paymentsRes.data ?? []) as Array<
      Pick<
        SubscriptionPaymentRow,
        | "id"
        | "amount_tzs"
        | "status"
        | "paid_at"
        | "period_starts_on"
        | "period_ends_on"
        | "provider_reference"
        | "created_at"
      >
    >,
  };
}

/** All catalogue plans, including inactive ones. Platform-admin eyes only. */
export async function listPlansForPlatform(): Promise<
  Array<PlanSummary & { subscribers: number }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*, subscriptions:restaurant_subscriptions(id, status)")
    .order("price_tzs", { ascending: true })
    .order("code", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (
    data as unknown as Array<
      SubscriptionPlanRow & { subscriptions: Array<{ id: string; status: string }> | null }
    >
  ).map((row) => ({
    ...toPlanSummary(row),
    subscribers: (row.subscriptions ?? []).filter((s) => isCurrent(s.status)).length,
  }));
}

export interface SubscriptionListItem {
  subscriptionId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  planCode: string;
  planName: string;
  status: SubscriptionStatus;
  tableLimit: number;
  usedTables: number;
  startsOn: string;
  renewsOn: string | null;
  expiresOn: string | null;
}

export interface SubscriptionListFilter {
  plan?: string;
  status?: string;
}

/** Subscriptions across all restaurants. Platform-admin eyes only. */
export async function listSubscriptionsForPlatform(
  filter: SubscriptionListFilter = {},
): Promise<SubscriptionListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("restaurant_subscriptions")
    .select(
      "id, restaurant_id, plan_id, status, table_limit, starts_on, renews_on, expires_on, restaurant:restaurants(name, slug), plan:subscription_plans(code, name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter.plan) {
    query = query.eq("plan.code", filter.plan);
  }

  if (filter.status) {
    query = query.eq("status", filter.status as Database["public"]["Enums"]["subscription_status"]);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const tableCounts = await supabase.from("restaurant_tables").select("restaurant_id");

  const usage = new Map<string, number>();
  for (const row of tableCounts.data ?? []) {
    usage.set(row.restaurant_id, (usage.get(row.restaurant_id) ?? 0) + 1);
  }

  return (
    data as unknown as Array<
      RestaurantSubscriptionRow & {
        restaurant: { name: string; slug: string } | null;
        plan: { code: string; name: string } | null;
      }
    >
  ).map((row) => ({
    subscriptionId: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant?.name ?? "Unknown restaurant",
    restaurantSlug: row.restaurant?.slug ?? "unknown",
    planCode: row.plan?.code ?? "unknown",
    planName: row.plan?.name ?? "Unknown plan",
    status: toSubscriptionStatus(row.status),
    tableLimit: row.table_limit,
    usedTables: usage.get(row.restaurant_id) ?? 0,
    startsOn: row.starts_on,
    renewsOn: row.renews_on,
    expiresOn: row.expires_on,
  }));
}

/** Plan codes for the filter dropdown on the subscriptions list. Platform admins only. */
export async function listPlanCodesForFilter(): Promise<Array<{ code: string; name: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("code, name")
    .order("code", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

export interface SubscriptionDetail {
  subscription: SubscriptionSnapshot;
  payments: SubscriptionPaymentRow[];
  tables: number;
  plans: PlanSummary[];
}

/** Detail for one restaurant's subscription. Platform-admin eyes only. */
export async function getSubscriptionDetailForPlatform(
  restaurantId: string,
): Promise<SubscriptionDetail | null> {
  const supabase = await createClient();

  const [subscriptionRes, paymentsRes, tablesRes, plansRes] = await Promise.all([
    supabase
      .from("restaurant_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("subscription_payments")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("restaurant_tables").select("id").eq("restaurant_id", restaurantId),
    supabase.from("subscription_plans").select("*").order("price_tzs", { ascending: true }),
  ]);

  const rows = (subscriptionRes.data ?? []) as unknown as Array<
    RestaurantSubscriptionRow & { plan: SubscriptionPlanRow | null }
  >;
  const current = rows.find((row) => isCurrent(row.status)) ?? rows[0] ?? null;
  const used = tablesRes.data?.length ?? 0;

  if (!current || !current.plan) {
    return null;
  }

  return {
    subscription: {
      id: current.id,
      status: toSubscriptionStatus(current.status),
      statusLabel: statusLabel(toSubscriptionStatus(current.status)),
      tableLimit: current.table_limit,
      usedTables: used,
      remainingTables: Math.max(current.table_limit - used, 0),
      startsOn: current.starts_on,
      renewsOn: current.renews_on,
      expiresOn: current.expires_on,
      cancelledAt: current.cancelled_at,
      plan: toPlanSummary(current.plan),
    },
    payments: (paymentsRes.data ?? []) as SubscriptionPaymentRow[],
    tables: used,
    plans: ((plansRes.data ?? []) as SubscriptionPlanRow[]).map(toPlanSummary),
  };
}
