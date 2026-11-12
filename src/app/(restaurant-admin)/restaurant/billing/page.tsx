import type { Metadata } from "next";

import { ShieldCheckIcon, WalletIcon } from "@/components/ui/icons";
import {
  Panel,
  StatusBadge,
  WorkspaceHeading,
  WorkspaceShell,
} from "@/components/restaurant/workspace-shell";
import { getRestaurantSubscriptionView } from "@/lib/subscription";
import { requireWorkspace, toShellMemberships } from "@/lib/restaurant";
import { formatTzs, statusLabel, usageLabel } from "@/lib/subscriptions-shared";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscription & billing",
  description: `Your subscription and billing on ${siteConfig.name}.`,
};

const lifecycleCopy: Record<string, { title: string; description: string }> = {
  pending: {
    title: "Pending activation",
    description: "Your subscription is pending. Ask the platform team to activate it.",
  },
  active: {
    title: "Active",
    description: "In good standing. Tables can be added up to your plan limit.",
  },
  past_due: {
    title: "Past due",
    description: "A payment is overdue. Contact the platform team to settle it.",
  },
  expired: {
    title: "Expired",
    description:
      "Your subscription expired. Existing tables keep working, but you cannot add new ones until it is renewed.",
  },
  cancelled: {
    title: "Cancelled",
    description:
      "This subscription has been cancelled. Contact the platform team to start a new term.",
  },
};

function subscriptionTone(status: string): "green" | "amber" | "neutral" {
  switch (status) {
    case "active":
      return "green";
    case "past_due":
    case "expired":
      return "amber";
    default:
      return "neutral";
  }
}

function formatPaymentDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-TZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function RestaurantBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const workspace = await requireWorkspace(searchParams, "/restaurant/billing");
  const { restaurant, memberships, user } = workspace;

  const { subscription, payments } = await getRestaurantSubscriptionView(restaurant.id);
  const fallback = {
    title: "Pending activation",
    description: "Your subscription is pending. Ask the platform team to activate it.",
  };
  const lifecycle = lifecycleCopy[subscription?.status ?? "pending"] ?? fallback;

  return (
    <WorkspaceShell
      userEmail={user.email}
      restaurant={{
        restaurantId: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
        role: workspace.membership.role,
      }}
      memberships={toShellMemberships(memberships)}
      active="billing"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <WorkspaceHeading
          eyebrow="Settings / Billing"
          title="Subscription & billing"
          description="Your plan, table allowance, and billing history. Only the platform can change your plan — contact them to upgrade or renew."
          icon={<WalletIcon />}
        />

        {subscription ? (
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Plan card */}
            <Panel
              className="lg:col-span-3"
              title="Your plan"
              description="Current subscription term for this restaurant."
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-semibold tracking-tight text-foreground">
                    {subscription.plan.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {subscription.plan.description ?? "Platform subscription plan."}
                  </p>
                </div>
                <StatusBadge tone={subscriptionTone(subscription.status)}>
                  {statusLabel(subscription.status)}
                </StatusBadge>
              </div>

              <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Monthly price</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {subscription.plan.priceTzs > 0 ? (
                      <>
                        {formatTzs(subscription.plan.priceTzs)}
                        <span className="ml-1 text-xs font-normal text-muted">
                          ({subscription.plan.billingIntervalLabel}, placeholder pricing)
                        </span>
                      </>
                    ) : (
                      <span>Custom — contact the platform</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Term started</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {formatPaymentDate(subscription.startsOn)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Renews</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {formatPaymentDate(subscription.renewsOn)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Expires</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {formatPaymentDate(subscription.expiresOn)}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 flex items-start gap-2 rounded-2xl bg-surface p-3 text-xs leading-5 text-muted">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-accent" />
                {lifecycle.description} Plan, status and table limits are controlled by the platform
                — contact them to upgrade, renew or reactivate.
              </p>
            </Panel>

            {/* Usage card */}
            <Panel
              className="lg:col-span-2"
              title="Tables"
              description="Your remaining capacity this term."
            >
              <div
                role="progressbar"
                aria-valuenow={subscription.usedTables}
                aria-valuemin={0}
                aria-valuemax={subscription.tableLimit}
                aria-label="Table usage"
                className="grid size-20 place-items-center rounded-3xl bg-accent/10"
              >
                <span className="text-xl font-semibold tabular-nums text-accent">
                  {subscription.tableLimit - subscription.usedTables}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {usageLabel(subscription.usedTables, subscription.tableLimit)}
              </p>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    subscription.usedTables >= subscription.tableLimit ? "bg-red-500" : "bg-accent",
                  )}
                  style={{
                    width: `${Math.min((subscription.usedTables / Math.max(subscription.tableLimit, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
              {subscription.usedTables >= subscription.tableLimit ? (
                <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">
                  Limit reached — you cannot add more tables until the platform raises your plan.
                </p>
              ) : (
                <p className="mt-3 text-xs leading-5 text-muted">
                  {subscription.tableLimit - subscription.usedTables} table
                  {subscription.tableLimit - subscription.usedTables === 1 ? "" : "s"} remaining on
                  your plan.
                </p>
              )}
            </Panel>
          </div>
        ) : (
          <Panel
            title="No subscription"
            description="This restaurant has not been given a subscription yet."
          >
            <p className="text-sm leading-6 text-muted">
              Once the platform approves this restaurant, an active plan will appear here with your
              table allowance.
            </p>
          </Panel>
        )}

        {/* Payment history */}
        <Panel
          title="Payment history"
          description="Recorded by the platform. Customer food payments are never included here."
        >
          {payments.length === 0 ? (
            <p className="text-sm leading-6 text-muted">
              No subscription payments recorded yet. When your plan is paid, it will show here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Date
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Amount
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Period
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 text-xs text-muted">
                        {formatPaymentDate(payment.paid_at ?? payment.created_at)}
                      </td>
                      <td className="py-3 pr-4 font-medium tabular-nums text-foreground">
                        {formatTzs(payment.amount_tzs)}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge
                          tone={
                            payment.status === "successful"
                              ? "green"
                              : payment.status === "failed" || payment.status === "cancelled"
                                ? "amber"
                                : "neutral"
                          }
                        >
                          {payment.status.replace("_", " ")}
                        </StatusBadge>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted">
                        {payment.period_starts_on && payment.period_ends_on
                          ? `${formatPaymentDate(payment.period_starts_on)} → ${formatPaymentDate(payment.period_ends_on)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </WorkspaceShell>
  );
}
