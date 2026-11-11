import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { membershipsWithRole, requireUser } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/security/roles";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Restaurant dashboard",
  description: `Manage your restaurants on ${siteConfig.name}.`,
};

export default async function RestaurantDashboardPage() {
  const user = await requireUser("/restaurant/dashboard");
  const memberships = await membershipsWithRole(user.id, ["restaurant_admin"]);

  if (memberships.length === 0) {
    const [waiter, kitchen] = await Promise.all([
      membershipsWithRole(user.id, ["waiter"]),
      membershipsWithRole(user.id, ["kitchen"]),
    ]);
    redirect(waiter.length > 0 ? "/waiter" : kitchen.length > 0 ? "/kitchen" : "/restaurant/apply");
  }

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
      <div className="flex items-center gap-3">
        <Logo />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Restaurant dashboard
        </p>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Your restaurants</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        You administer{" "}
        {memberships.length === 1 ? "one restaurant" : `${memberships.length} restaurants`}. The
        full dashboard arrives in later phases; for now you can review your restaurants.
      </p>

      <ul className="mt-6 grid gap-4">
        {memberships.map((membership) => {
          return (
            <li
              key={membership.restaurantId}
              className="rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{membership.restaurant.name}</p>
                  <p className="text-xs text-muted">/{membership.restaurant.slug}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {ROLE_LABELS[membership.role]}
                </span>
              </div>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Application</dt>
                  <dd className="mt-1 font-medium">{membership.restaurant.applicationStatus}</dd>
                </div>
                <div>
                  <dt className="text-muted">Operations</dt>
                  <dd className="mt-1 font-medium">{membership.restaurant.operationalStatus}</dd>
                </div>
              </dl>
              <div className="mt-5 border-t border-border pt-5 text-sm text-muted">
                Menu, tables, staff, orders and subscription controls land in Phases 4–5.
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-8">
        <Link href="/profile" className={cn(buttonVariants({ variant: "secondary" }))}>
          View your profile
        </Link>
      </div>
    </main>
  );
}
