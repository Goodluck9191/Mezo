import type { Metadata } from "next";

import { UtensilsIcon } from "@/components/ui/icons";
import { ItemForm } from "@/components/menu/item-form";
import { Panel, WorkspaceHeading, WorkspaceShell } from "@/components/restaurant/workspace-shell";
import { listCategoriesForRestaurant } from "@/lib/menu";
import { requireWorkspace, toShellMemberships } from "@/lib/restaurant";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add a menu item",
  description: `Add a new menu item to your restaurant on ${siteConfig.name}.`,
};

export default async function NewMenuItemPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const workspace = await requireWorkspace(searchParams, "/restaurant/menu/items/new");
  const { restaurant, memberships, user } = workspace;

  const categories = await listCategoriesForRestaurant(restaurant.id);
  const liveCategories = categories.filter((c) => c.archivedAt === null);

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
      <div className="mx-auto max-w-3xl space-y-6">
        <WorkspaceHeading
          eyebrow="Menu / New item"
          title="Add a menu item"
          description="Name, price, category, photo and availability. Unavailable items are labelled in the public menu but cannot be ordered."
          icon={<UtensilsIcon />}
        />

        {liveCategories.length === 0 ? (
          <Panel>
            <p className="text-sm leading-6 text-muted">
              You need at least one category before you can add items.{" "}
              <a
                href={`/restaurant/menu/categories?restaurant=${encodeURIComponent(restaurant.slug)}`}
                className="font-medium text-accent hover:underline"
              >
                Create a category first
              </a>
              .
            </p>
          </Panel>
        ) : (
          <ItemForm
            restaurantId={restaurant.id}
            categories={liveCategories.map((c) => ({ id: c.id, name: c.name }))}
          />
        )}
      </div>
    </WorkspaceShell>
  );
}
