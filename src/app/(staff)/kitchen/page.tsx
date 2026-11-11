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
  title: "Kitchen",
  description: `Kitchen console for ${siteConfig.name}.`,
};

export default async function KitchenPage() {
  const user = await requireUser("/kitchen");
  const memberships = await membershipsWithRole(user.id, ["kitchen", "restaurant_admin"]);

  if (memberships.length === 0) {
    const waiter = await membershipsWithRole(user.id, ["waiter"]);
    redirect(waiter.length > 0 ? "/waiter" : "/restaurant/apply");
  }

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
      <div className="flex items-center gap-3">
        <Logo />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Kitchen console
        </p>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Incoming orders</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        You see the restaurants whose orders you prepare. The live order board arrives in Phase 4.
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
