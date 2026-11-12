import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { membershipsWithRole, requireUser } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/security/roles";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Waiter",
  description: `Waiter console for ${siteConfig.name}.`,
};

export default async function WaiterPage() {
  const user = await requireUser("/waiter");
  const memberships = await membershipsWithRole(user.id, ["waiter", "restaurant_admin"]);

  if (memberships.length === 0) {
    const kitchen = await membershipsWithRole(user.id, ["kitchen"]);
    redirect(kitchen.length > 0 ? "/kitchen" : "/restaurant/apply");
  }

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
      <div className="flex items-center gap-3">
        <Logo />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Floor console
        </p>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Tables and guests</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        You see the tables where you work. Live ordering and approvals arrive in Phase 5.
      </p>

      <ul className="mt-6 grid gap-4">
        {memberships.map((membership) => (
          <li
            key={membership.restaurantId}
            className="rounded-3xl border border-border bg-surface-strong p-6 shadow-sm sm:p-8"
          >
            <p className="text-lg font-semibold">{membership.restaurant.name}</p>
            <p className="text-xs text-muted">/{membership.restaurant.slug}</p>
            <p className="mt-1 inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              {ROLE_LABELS[membership.role]}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <Link href="/profile" className={buttonVariants({ variant: "secondary" })}>
          Your profile
        </Link>
      </div>
    </main>
  );
}
