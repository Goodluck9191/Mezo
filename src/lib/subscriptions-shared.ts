/**
 * Client-safe subscription vocabulary shared by server and browser.
 * Keep this free of server-only imports.
 */

export type SubscriptionStatus = "pending" | "active" | "past_due" | "expired" | "cancelled";

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending: "Pending",
  active: "Active",
  past_due: "Past due",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function statusLabel(status: SubscriptionStatus): string {
  return SUBSCRIPTION_STATUS_LABELS[status] ?? "Past due";
}

export function billingIntervalLabel(interval: string): string {
  switch (interval) {
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default:
      return interval;
  }
}

/** Whole-shilling money display. Prices are placeholders pending commercial review. */
export function formatTzs(amount: number | bigint | string | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `TZS ${new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 }).format(value)}`;
}

/** Short usage string, e.g. "12 of 20 tables". */
export function usageLabel(used: number, limit: number): string {
  return `${used} of ${limit} tables used`;
}
