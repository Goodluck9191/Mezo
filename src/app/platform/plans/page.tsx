import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { PlanCreateForm } from "@/components/platform/plan-create-form";
import { PlanRowEditor } from "@/components/platform/plan-row-editor";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listPlansForPlatform } from "@/lib/subscription";
import { billingIntervalLabel, formatTzs } from "@/lib/subscriptions-shared";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plan catalogue",
  description: `Manage subscription plans on ${siteConfig.name}.`,
};

export default async function PlatformPlansPage() {
  await requirePlatformAdmin("/platform/plans");

  const plans = await listPlansForPlatform();

  return (
    <main id="main" className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
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
          className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
        >
          Subscriptions
        </Link>
        <Link
          href="/platform/plans"
          aria-current="page"
          className="rounded-full bg-accent/10 px-3.5 py-1.5 text-xs font-semibold text-accent"
        >
          Plan catalogue
        </Link>
      </nav>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">Plan catalogue</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Every plan the platform offers. Prices are placeholders pending commercial approval — they
        are labelled as such and must be replaced before any commercial launch.
      </p>

      <section className="mt-6 rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8">
        <h2 className="text-base font-semibold">Catalogue ({plans.length})</h2>
        <ul className="mt-4 divide-y divide-border">
          {plans.map((plan) => (
            <li key={plan.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                    {plan.name}
                    <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-muted">
                      {plan.code}
                    </span>
                    {plan.isActive ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Inactive
                      </span>
                    )}
                    <span className="text-[11px] font-normal tabular-nums text-muted">
                      {plan.subscribers} current subscriber{plan.subscribers === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted">
                    {plan.tableLimit} tables · {billingIntervalLabel(plan.billingInterval)} ·{" "}
                    {plan.priceTzs > 0
                      ? `${formatTzs(plan.priceTzs)} / ${plan.billingInterval === "yearly" ? "year" : "month"}`
                      : "Custom pricing"}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <PlanRowEditor
                  planId={plan.id}
                  name={plan.name}
                  description={plan.description ?? ""}
                  priceTzs={plan.priceTzs}
                  billingInterval={plan.billingInterval as "monthly" | "yearly"}
                  tableLimit={plan.tableLimit}
                  isActive={plan.isActive}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8">
        <h2 className="text-base font-semibold">Create a plan</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          New catalogue entries are placeholders until the commercial terms are approved.
        </p>
        <div className="mt-4">
          <PlanCreateForm />
        </div>
      </section>
    </main>
  );
}
