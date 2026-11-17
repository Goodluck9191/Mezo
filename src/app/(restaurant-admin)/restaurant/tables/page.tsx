import type { Metadata } from "next";

import { QrCodeIcon, UtensilsIcon } from "@/components/ui/icons";
import {
  Panel,
  StatusBadge,
  WorkspaceHeading,
  WorkspaceShell,
} from "@/components/restaurant/workspace-shell";
import { AddTableForm, TableRowActions } from "@/components/restaurant/table-actions";
import { requireWorkspace, toShellMemberships } from "@/lib/restaurant";
import { getTablesForRestaurant } from "@/lib/table-access";
import { getRestaurantSubscriptionView } from "@/lib/subscription";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tables & QR codes",
  description: `Manage tables and printable QR codes for ${siteConfig.name}.`,
};

export default async function RestaurantTablesPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const workspace = await requireWorkspace(searchParams, "/restaurant/tables");
  const { restaurant, memberships, user } = workspace;

  const [tables, subscriptionView] = await Promise.all([
    getTablesForRestaurant(restaurant.id),
    getRestaurantSubscriptionView(restaurant.id),
  ]);

  const subscription = subscriptionView.subscription;
  const tableLimit = subscription?.tableLimit ?? null;
  const usedTables = tables.length;
  const remainingTables = tableLimit === null ? null : Math.max(tableLimit - usedTables, 0);
  const usagePercent =
    tableLimit && tableLimit > 0 ? Math.min(100, Math.round((usedTables / tableLimit) * 100)) : 0;

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
      active="tables"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <WorkspaceHeading
          eyebrow="Tables"
          title="Tables & QR codes"
          description="Every table gets its own QR code. Customers scan it, wait for a waiter to confirm their seating, then order. QR codes are shown once — download or print them when they are generated."
          icon={<QrCodeIcon />}
        />

        {/* Plan usage */}
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">Plan usage</h2>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                The table limit is enforced by your subscription. Only the platform can change it.
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {usedTables}
              {tableLimit !== null ? ` / ${tableLimit}` : ""} tables
            </p>
          </div>
          {tableLimit !== null ? (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={tableLimit}
              aria-valuenow={usedTables}
              aria-label="Tables used on this plan"
              className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  usagePercent >= 100 ? "bg-amber-500" : "bg-accent",
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-muted">
              No subscription on file for this restaurant. Contact the platform to set one up.
            </p>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Add table */}
          <Panel
            className="lg:col-span-2"
            title="Add a table"
            description="Creates the table and its QR code. The code is shown once, right after creation."
          >
            <AddTableForm
              restaurantId={restaurant.id}
              remainingTables={remainingTables}
              tableLimit={tableLimit}
            />
          </Panel>

          {/* Table list */}
          <Panel
            className="lg:col-span-3"
            title="Your tables"
            description="Live session status per table. Guests seated in an open session order until a waiter closes it."
          >
            {tables.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                <UtensilsIcon aria-hidden="true" className="mx-auto size-8 text-muted" />
                <p className="mt-3 text-sm font-medium text-foreground">No tables yet</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted">
                  Add your first table — its QR code appears once, so print or download it right
                  away.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {tables.map((table) => (
                  <li
                    key={table.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                        {table.name}
                        {table.isActive ? null : <StatusBadge tone="neutral">Inactive</StatusBadge>}
                        {table.sessionStatus === "active" ? (
                          <StatusBadge tone="green">
                            Open session · {table.guestCount}{" "}
                            {table.guestCount === 1 ? "guest" : "guests"}
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">No open session</StatusBadge>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        QR code shown at creation or regeneration
                      </p>
                    </div>
                    <TableRowActions table={table} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </WorkspaceShell>
  );
}
