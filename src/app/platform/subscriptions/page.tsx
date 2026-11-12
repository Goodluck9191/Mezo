import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/shared/logo";
import { ExpireOverdueButton } from "@/components/platform/expire-overdue-button";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listPlanCodesForFilter, listSubscriptionsForPlatform } from "@/lib/subscription";
import { statusLabel } from "@/lib/subscriptions-shared";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscriptions",
  description: `Platform subscription management for ${siteConfig.name}.`,
};

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
  { value: "pending", label: "Pending" },
] as const;

const toneFor = (status: string): "green" | "amber" | "neutral" =>
  status === "active"
    ? "green"
    : status === "past_due" || status === "expired"
      ? "amber"
      : "neutral";

function Badge({ tone, children }: { tone: "green" | "amber" | "neutral"; children: ReactNode }) {
  const styles = {
    green: "bg-accent/10 text-accent",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
    neutral: "bg-surface text-muted",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}

export default async function PlatformSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; status?: string }>;
}) {
  await requirePlatformAdmin("/platform/subscriptions");

  const { plan, status } = await searchParams;
  const [subscriptions, planCodes] = await Promise.all([
    listSubscriptionsForPlatform({
      plan: plan || undefined,
      status: status || undefined,
    }),
    listPlanCodesForFilter(),
  ]);

  const counts = {
    active: subscriptions.filter((s) => s.status === "active").length,
    past_due: subscriptions.filter((s) => s.status === "past_due").length,
    expired: subscriptions.filter((s) => s.status === "expired").length,
    cancelled: subscriptions.filter((s) => s.status === "cancelled").length,
  };

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
          aria-current="page"
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

      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">Subscriptions</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Every restaurant&apos;s subscription. Assign plans, move subscriptions through the
        lifecycle, and record payments. Food payments never appear here.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Active", value: counts.active, tone: "green" as const },
          { label: "Past due", value: counts.past_due, tone: "amber" as const },
          { label: "Expired", value: counts.expired, tone: "amber" as const },
          { label: "Cancelled", value: counts.cancelled, tone: "neutral" as const },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-3xl border border-border bg-surface-strong p-4 shadow-sm"
          >
            <p className="text-xs text-muted">{tile.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Overdue sweep marks subscriptions past renewal as expired.
        </p>
        <ExpireOverdueButton />
      </div>

      <form
        method="get"
        className="mt-3 flex flex-wrap items-end gap-3 rounded-3xl border border-border bg-surface-strong p-4"
      >
        <label htmlFor="filter-plan" className="space-y-1.5 text-xs font-medium text-muted">
          <span>Plan</span>
          <select
            id="filter-plan"
            name="plan"
            defaultValue={plan ?? ""}
            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
          >
            <option value="">All plans</option>
            {planCodes.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name} ({plan.code})
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="filter-status" className="space-y-1.5 text-xs font-medium text-muted">
          <span>Status</span>
          <select
            id="filter-status"
            name="status"
            defaultValue={status ?? ""}
            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Apply filters
        </button>
        {(plan || status) && (
          <Link
            href="/platform/subscriptions"
            className="inline-flex h-10 items-center rounded-full border border-border px-4 text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            Clear
          </Link>
        )}
      </form>

      <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface-strong shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Restaurant
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Plan
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Tables
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Renews
                </th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted">
                    Nothing matches. Adjust the filters above.
                  </td>
                </tr>
              ) : (
                subscriptions.map((subscription) => (
                  <tr
                    key={subscription.subscriptionId}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/platform/subscriptions/${subscription.restaurantId}`}
                        className="font-semibold text-foreground hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {subscription.restaurantName}
                      </Link>
                      <span className="block text-[11px] text-muted">
                        /{subscription.restaurantSlug}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{subscription.planName}</td>
                    <td className="px-4 py-3 tabular-nums text-xs text-muted">
                      {subscription.usedTables} / {subscription.tableLimit}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={toneFor(subscription.status)}>
                        {statusLabel(subscription.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-muted">
                      {subscription.renewsOn
                        ? new Date(subscription.renewsOn).toLocaleDateString("en-TZ", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-center text-xs text-muted">
        Showing the most recent 100 matching subscriptions.
      </p>
    </main>
  );
}
