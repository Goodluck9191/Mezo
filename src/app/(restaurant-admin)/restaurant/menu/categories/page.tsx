import type { Metadata } from "next";

import { ClipboardListIcon } from "@/components/ui/icons";
import { CategoryManager } from "@/components/menu/category-manager";
import { WorkspaceHeading, WorkspaceShell } from "@/components/restaurant/workspace-shell";
import { listCategoriesForRestaurant } from "@/lib/menu";
import { requireWorkspace, toShellMemberships } from "@/lib/restaurant";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage categories",
  description: `Manage menu categories for your restaurant on ${siteConfig.name}.`,
};

export default async function RestaurantMenuCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const workspace = await requireWorkspace(searchParams, "/restaurant/menu/categories");
  const { restaurant, memberships, user } = workspace;

  const categories = await listCategoriesForRestaurant(restaurant.id, { includeArchived: true });

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
      <div className="mx-auto max-w-5xl space-y-6">
        <WorkspaceHeading
          eyebrow="Menu / Categories"
          title="Categories"
          description="Create, reorder, hide and archive categories. Renaming or reordering affects the public menu immediately."
          icon={<ClipboardListIcon />}
        />

        <CategoryManager restaurantId={restaurant.id} categories={categories} />
      </div>
    </WorkspaceShell>
  );
}
