import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import { AssignPlanForm } from "@/components/platform/assign-plan-form";
import { RecordPaymentForm } from "@/components/platform/record-payment-form";
import { StatusActions } from "@/components/platform/status-actions";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getSubscriptionDetailForPlatform } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { billingIntervalLabel, formatTzs, statusLabel } from "@/lib/subscriptions-shared";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscription details",
  description: `Platform subscription detail on ${siteConfig.name}.`,
};

const toneFor = (status: string): "green" | "amber" | "neutral" =>
  status === "active"
    ? "green"
    : status === "past_due" || status === "expired"
      ? "amber"
      : "neutral";

function paymentTone(status: string): "green" | "amber" | "neutral" {
  switch (status) {
    case "successful":
      return "green";
    case "failed":
    case "cancelled":
    case "refunded":
      return "amber";
    default:
      return "neutral";
  }
}

function formatDay(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-TZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function PlatformSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin("/platform/subscriptions");

  const { id } = await params;
  const [detail, restaurantRes] = await Promise.all([
    getSubscriptionDetailForPlatform(id),
    createClient().then((supabase) =>
      supabase.from("restaurants").select("name, slug").eq("id", id).maybeSingle(),
    ),
  ]);

  if (!detail) {
    notFound();
  }

  const { subscription, payments, tables, plans } = detail;
  const activePlans = plans.filter((plan) => plan.isActive);
  const restaurantName = restaurantRes.data?.name ?? "Restaurant";
  const restaurantSlug = restaurantRes.data?.slug ?? null;

  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
      <div className="flex items-center gap-3">
        <Logo />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Platform administration
        </p>
      </div>

      <nav
        aria-label="Platform sections"
        className="mt-4 flex flex-wrap items-center gap-2 text-sm"
      >
        <Link
          href="/platform"
          className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
        >
          Applications
        </Link>
        <Link
          href="/platform/subscriptions"
          className="rounded-full bg-accent/10 px-3.5 py-1.5 text-xs font-semibold text-accent"
        >
          Subscriptions
        </Link>
        <Link
          href="/platform/plans"
          className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
        >
          Plan catalogue
        </Link>
      </nav>

      <p className="mt-6 text-xs uppercase tracking-[0.18em] text-muted">
        Subscription / {restaurantSlug ? `/${restaurantSlug}` : subscription.plan.name}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{restaurantName}</h1>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
            toneFor(subscription.status) === "green" && "bg-accent/10 text-accent",
            toneFor(subscription.status) === "amber" &&
              "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
            toneFor(subscription.status) === "neutral" && "bg-surface text-muted",
          )}
        >
          {statusLabel(subscription.status)}
        </span>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {/* Subscription summary + lifecycle */}
        <section className="rounded-3xl border border-border bg-surface-strong p-6 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">{subscription.plan.name}</h2>
              <p className="mt-0.5 text-xs text-muted">Current term for this restaurant</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums">
                {tables} / {subscription.tableLimit}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-muted">Tables</p>
            </div>
          </div>

          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                tables >= subscription.tableLimit ? "bg-red-500" : "bg-accent",
              )}
              style={{
                width: `${Math.min((tables / Math.max(subscription.tableLimit, 1)) * 100, 100)}%`,
              }}
            />
          </div>

          <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Price</dt>
              <dd className="mt-1 font-medium">
                {subscription.plan.priceTzs > 0 ? (
                  <>
                    {formatTzs(subscription.plan.priceTzs)}{" "}
                    <span className="text-xs font-normal text-muted">
                      ({billingIntervalLabel(subscription.plan.billingInterval)}, placeholder)
                    </span>
                  </>
                ) : (
                  "Custom pricing"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Billing interval</dt>
              <dd className="mt-1 font-medium">
                {billingIntervalLabel(subscription.plan.billingInterval)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Term started</dt>
              <dd className="mt-1 font-medium">{formatDay(subscription.startsOn)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Renews</dt>
              <dd className="mt-1 font-medium">{formatDay(subscription.renewsOn)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Expires</dt>
              <dd className="mt-1 font-medium">{formatDay(subscription.expiresOn)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Cancelled</dt>
              <dd className="mt-1 font-medium">
                {subscription.cancelledAt ? formatDay(subscription.cancelledAt) : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Lifecycle</h3>
            <div className="mt-3">
              <StatusActions restaurantId={id} currentStatus={subscription.status} />
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Assign / change plan</h3>
            <p className="mt-1 text-xs leading-5 text-muted">
              Closes the current term as cancelled and opens an active term on the chosen plan.
              Existing tables are never removed; a smaller limit simply blocks new tables until
              usage drops.
            </p>
            <div className="mt-3">
              <AssignPlanForm
                restaurantId={id}
                plans={activePlans.map((plan) => ({
                  id: plan.id,
                  name: plan.name,
                  tableLimit: plan.tableLimit,
                  billingInterval: plan.billingInterval,
                }))}
              />
            </div>
          </div>
        </section>

        {/* Record payment + payment history */}
        <section className="space-y-5">
          <div className="rounded-3xl border border-border bg-surface-strong p-6 shadow-sm">
            <h2 className="text-sm font-semibold">Record a payment</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Operator-collected payments only. Provider webhooks are not connected yet.
            </p>
            <div className="mt-4">
              <RecordPaymentForm restaurantId={id} />
            </div>
          </div>
        </section>

        {/* Payment history */}
        <section className="rounded-3xl border border-border bg-surface-strong p-6 shadow-sm xl:col-span-3">
          <h2 className="text-sm font-semibold">Payment history ({payments.length})</h2>
          {payments.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted">
              No subscription payments recorded for this restaurant.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Recorded
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Amount
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Reference
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      Period
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 text-xs text-muted">
                        {formatDay(payment.paid_at ?? payment.created_at)}
                      </td>
                      <td className="py-3 pr-4 font-medium tabular-nums">
                        {formatTzs(payment.amount_tzs)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                            paymentTone(payment.status) === "green" && "bg-accent/10 text-accent",
                            paymentTone(payment.status) === "amber" &&
                              "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
                            paymentTone(payment.status) === "neutral" && "bg-surface text-muted",
                          )}
                        >
                          {payment.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-muted">
                        {payment.provider_reference ?? "—"}
                      </td>
                      <td className="py-3 text-xs text-muted">
                        {payment.period_starts_on && payment.period_ends_on
                          ? `${formatDay(payment.period_starts_on)} → ${formatDay(payment.period_ends_on)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
