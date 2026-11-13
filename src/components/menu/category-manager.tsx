import {
  CategoryActiveToggle,
  CategoryArchiveButton,
} from "@/components/menu/category-row-actions";
import { CategoryCreateForm, CategoryEditForm } from "@/components/menu/category-edit-forms";
import { CategoryMoveButton } from "@/components/menu/category-move-button";
import { UtensilsIcon } from "@/components/ui/icons";
import type { CategorySummary } from "@/lib/menu";

/** Category management: create, rename, reorder, activate/deactivate, archive/restore. */
export function CategoryManager({
  restaurantId,
  categories,
}: {
  restaurantId: string;
  categories: CategorySummary[];
}) {
  const liveCategories = categories.filter((c) => c.archivedAt === null);
  const archived = categories.filter((c) => c.archivedAt !== null);
  const orderedIds = liveCategories.map((c) => c.id);

  return (
    <div className="space-y-6">
      {/* Create */}
      <CategoryCreateForm restaurantId={restaurantId} />

      {/* Live list */}
      {liveCategories.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border bg-surface px-6 py-8 text-center text-sm leading-6 text-muted">
          No categories yet. Add your first one above — e.g. Breakfast, Lunch, Dinner, Drinks.
        </p>
      ) : (
        <ol className="space-y-2">
          {liveCategories.map((category, index) => (
            <li
              key={category.id}
              className="flex flex-col gap-3 rounded-3xl border border-border bg-surface-strong p-4 shadow-sm lg:flex-row lg:items-center"
            >
              <div className="flex items-center gap-3 lg:w-64 lg:shrink-0">
                <div
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent"
                >
                  <UtensilsIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{category.name}</p>
                  <p className="text-[11px] text-muted">
                    {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <CategoryEditForm
                categoryId={category.id}
                name={category.name}
                description={category.description}
              />

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <CategoryActiveToggle categoryId={category.id} isActive={category.isActive} />
                <CategoryMoveButton
                  direction="up"
                  index={index}
                  orderedIds={orderedIds}
                  restaurantId={restaurantId}
                  disabled={index === 0}
                />
                <CategoryMoveButton
                  direction="down"
                  index={index}
                  orderedIds={orderedIds}
                  restaurantId={restaurantId}
                  disabled={index === liveCategories.length - 1}
                />
                <CategoryArchiveButton categoryId={category.id} archived={false} />
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Archived */}
      {archived.length > 0 ? (
        <section
          aria-label="Archived categories"
          className="rounded-3xl border border-dashed border-border bg-surface p-5"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Archived ({archived.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {archived.map((category) => (
              <li
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <span className="text-muted">
                  {category.name} · {category.itemCount} items (hidden)
                </span>
                <CategoryArchiveButton categoryId={category.id} archived />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
