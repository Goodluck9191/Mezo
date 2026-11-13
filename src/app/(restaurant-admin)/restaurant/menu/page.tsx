import type { Metadata } from "next";

import { ClipboardListIcon, UtensilsIcon } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import {
  Panel,
  QuickActionLink,
  WorkspaceHeading,
  WorkspaceShell,
} from "@/components/restaurant/workspace-shell";
import { ItemsTable } from "@/components/menu/items-table";
import {
  listCategoriesForRestaurant,
  listItemsForRestaurant,
  menuCountsForRestaurant,
} from "@/lib/menu";
import { requireWorkspace, toShellMemberships } from "@/lib/restaurant";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu",
  description: `Manage the menu for your restaurant on ${siteConfig.name}.`,
};

export default async function RestaurantMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string; q?: string; category?: string; state?: string }>;
}) {
  const { restaurant: slugParam, q, category, state } = await searchParams;
  const workspace = await requireWorkspace({ restaurant: slugParam }, "/restaurant/menu");
  const { restaurant, memberships, user } = workspace;

  const [counts, categories] = await Promise.all([
    menuCountsForRestaurant(restaurant.id),
    listCategoriesForRestaurant(restaurant.id, { includeArchived: true }),
  ]);

  const items = await listItemsForRestaurant(restaurant.id, {
    query: q,
    categoryId: category || undefined,
    availability:
      state === "available" ? "available" : state === "unavailable" ? "unavailable" : undefined,
    includeArchived: true,
  });

  const liveCategories = categories.filter((c) => c.archivedAt === null);
  const suffix = `?restaurant=${encodeURIComponent(restaurant.slug)}`;

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
      active="menu"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <WorkspaceHeading
          eyebrow="Restaurant menu"
          title="Menu"
          description="Categories and items your customers browse in the public menu. Archive hides; items stay safe for order history."
          icon={<UtensilsIcon />}
        />

        {/* Counts */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Categories", value: counts.categories },
            { label: "Items", value: counts.items },
            { label: "Available", value: counts.available },
            { label: "Unavailable", value: counts.unavailable },
          ].map((tile) => (
            <div
              key={tile.label}
              className="rounded-3xl border border-border bg-surface-strong p-4 shadow-sm"
            >
              <p className="text-[11px] uppercase tracking-wide text-muted">{tile.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                {tile.value}
              </p>
            </div>
          ))}
        </div>

        <section aria-label="Menu quick actions" className="grid gap-3 sm:grid-cols-2">
          <QuickActionLink
            href={`/restaurant/menu/items/new${suffix}`}
            title="Add an item"
            description="Name, category, price, image and availability."
            icon={<UtensilsIcon className="size-5" />}
          />
          <QuickActionLink
            href={`/restaurant/menu/categories${suffix}`}
            title="Manage categories"
            description="Create, rename, reorder, hide and archive categories."
            icon={<ClipboardListIcon className="size-5" />}
          />
        </section>

        {/* Items table with search + filter */}
        <Panel
          title="Menu items"
          description="Search, filter and manage items. Archive instead of delete."
        >
          <form method="get" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
            <input type="hidden" name="restaurant" value={restaurant.slug} />
            <label htmlFor="menu-search" className="sr-only">
              Search items
            </label>
            <input
              id="menu-search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search items…"
              className="h-10 w-full rounded-xl border border-border bg-surface px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <label htmlFor="menu-filter-category" className="sr-only">
              Category
            </label>
            <select
              id="menu-filter-category"
              name="category"
              defaultValue={category ?? ""}
              className="h-10 rounded-xl border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <option value="">All categories</option>
              {liveCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label htmlFor="menu-filter-state" className="sr-only">
              Availability
            </label>
            <select
              id="menu-filter-state"
              name="state"
              defaultValue={state ?? ""}
              className="h-10 rounded-xl border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <option value="">All items</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
            >
              Filter
            </button>
          </form>

          <div className="mt-4">
            <ItemsTable items={items} slug={restaurant.slug} />
          </div>
        </Panel>
      </div>
    </WorkspaceShell>
  );
}
