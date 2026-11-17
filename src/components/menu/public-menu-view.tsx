import { UtensilsIcon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";

export interface PublicMenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    priceTzs: number;
    imageUrl: string | null;
    isAvailable: boolean;
    sortOrder: number;
  }>;
}

export function formatPrice(priceTzs: number): string {
  return `TZS ${new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 }).format(priceTzs)}`;
}

/** Row shape returned by the get_public_menu RPC. */
export interface PublicMenuRow {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_slug: string;
  restaurant_description: string | null;
  restaurant_logo_url: string | null;
  restaurant_contact_phone: string | null;
  restaurant_address_line1: string | null;
  restaurant_address_line2: string | null;
  restaurant_city: string | null;
  restaurant_region: string | null;
  restaurant_country_code: string;
  category_id: string;
  category_name: string;
  category_description: string | null;
  category_sort_order: number;
  item_id: string;
  item_name: string;
  item_description: string | null;
  price_tzs: number;
  item_image_url: string | null;
  is_available: boolean;
  item_sort_order: number;
}

/** Groups flat get_public_menu rows into the category/items tree for display. */
export function buildCategories(rows: PublicMenuRow[]): PublicMenuCategory[] {
  const categories: PublicMenuCategory[] = [];
  const categoryMap = new Map<string, PublicMenuCategory>();

  for (const row of rows) {
    let bucket = categoryMap.get(row.category_id);
    if (!bucket) {
      bucket = {
        id: row.category_id,
        name: row.category_name,
        description: row.category_description,
        sortOrder: row.category_sort_order,
        items: [],
      };
      categoryMap.set(row.category_id, bucket);
      categories.push(bucket);
    }

    bucket.items.push({
      id: row.item_id,
      name: row.item_name,
      description: row.item_description,
      priceTzs: Number(row.price_tzs),
      imageUrl: row.item_image_url,
      isAvailable: row.is_available,
      sortOrder: row.item_sort_order,
    });
  }

  return categories;
}

/**
 * Shared rendering of a restaurant's published menu. Used by the anonymous
 * public menu route and the customer QR entry page. Presentational only.
 */
export function PublicMenuView({ categories }: { categories: PublicMenuCategory[] }) {
  if (categories.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border px-6 py-14 text-center text-sm leading-6 text-muted">
        This restaurant has not published a menu yet.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {categories.map((category) => (
        <section key={category.id} aria-label={category.name}>
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-2">
            <h2 className="text-xl font-semibold tracking-tight">{category.name}</h2>
            {category.description ? (
              <p className="text-xs text-muted">{category.description}</p>
            ) : null}
          </div>

          <ul className="mt-4 divide-y divide-border">
            {category.items.map((item) => (
              <li key={item.id} className="flex items-start gap-4 py-4">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className={cn(
                      "size-20 shrink-0 rounded-2xl border border-border object-cover sm:size-24",
                      !item.isAvailable && "opacity-50 grayscale",
                    )}
                    loading="lazy"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="grid size-20 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-muted sm:size-24"
                  >
                    <UtensilsIcon className="size-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="tabular-nums font-semibold">{formatPrice(item.priceTzs)}</p>
                  </div>
                  {item.description ? (
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
                      {item.description}
                    </p>
                  ) : null}
                  {!item.isAvailable ? (
                    <span className="mt-2 inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Currently unavailable
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
