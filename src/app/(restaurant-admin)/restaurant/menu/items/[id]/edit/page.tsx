import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UtensilsIcon } from "@/components/ui/icons";
import { ItemForm } from "@/components/menu/item-form";
import { WorkspaceHeading, WorkspaceShell } from "@/components/restaurant/workspace-shell";
import { getItemForEdit, listCategoriesForRestaurant } from "@/lib/menu";
import { requireWorkspace, toShellMemberships } from "@/lib/restaurant";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit item",
  description: `Edit a menu item on ${siteConfig.name}.`,
};

export default async function EditMenuItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const { restaurant: slugParam } = await searchParams;
  const workspace = await requireWorkspace({ restaurant: slugParam }, "/restaurant/menu/items");
  const { restaurant, memberships, user } = workspace;

  const { id } = await params;
  const [item, categories] = await Promise.all([
    getItemForEdit(restaurant.id, id),
    listCategoriesForRestaurant(restaurant.id),
  ]);

  if (!item) {
    notFound();
  }

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
          eyebrow="Menu / Edit item"
          title={item.name}
          description="Edit the item below. Archive hides it from the public menu; it remains safe for order history."
          icon={<UtensilsIcon />}
        />

        <ItemForm
          itemId={item.id}
          restaurantId={restaurant.id}
          categories={liveCategories.map((c) => ({ id: c.id, name: c.name }))}
          defaults={{
            name: item.name,
            description: item.description,
            priceTzs: item.priceTzs,
            categoryId: item.categoryId,
            imageUrl: item.imageUrl,
            isAvailable: item.isAvailable,
          }}
        />
      </div>
    </WorkspaceShell>
  );
}
