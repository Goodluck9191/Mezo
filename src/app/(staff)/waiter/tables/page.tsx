import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import { BellIcon, UsersIcon } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { WaiterTablesBoard } from "@/components/staff/waiter-tables-board";
import { membershipsWithRole, requireUser } from "@/lib/auth/guards";
import { getTableAccessBoard } from "@/lib/table-access";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tables — Waiter",
  description: `Confirm seating requests and manage open tables on ${siteConfig.name}.`,
};

export default async function WaiterTablesPage() {
  const user = await requireUser("/waiter/tables");
  const memberships = await membershipsWithRole(user.id, ["waiter", "restaurant_admin"]);

  if (memberships.length === 0) {
    const kitchen = await membershipsWithRole(user.id, ["kitchen"]);
    redirect(kitchen.length > 0 ? "/kitchen" : "/restaurant/apply");
  }

  const board = await getTableAccessBoard(user.id);

  return (
    <main id="main" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Floor console
          </p>
        </div>
        <Link href="/waiter" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          All consoles
        </Link>
      </div>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tables and guests</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
          Confirm seating before orders open. A customer scanning a table QR code always waits for
          your approval — across every restaurant you work for.
        </p>
      </div>

      <div className="mt-8">
        <WaiterTablesBoard
          requests={board.requests}
          sessions={board.sessions}
          restaurants={board.restaurants}
        />
      </div>

      <p className="mt-10 flex items-center gap-2 text-xs text-muted">
        <BellIcon className="size-4" />
        New requests appear automatically. Approvals open ordering for that table; closing a table
        clears it for the next party.
        <UsersIcon className="size-4" />
      </p>
    </main>
  );
}
