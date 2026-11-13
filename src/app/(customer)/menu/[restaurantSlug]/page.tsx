import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import { QrCodeIcon, UtensilsIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site";
import { cn } from "@/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu",
  description: `Browse restaurants on ${siteConfig.name}.`,
};

interface PublicMenuRow {
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

interface PublicCategory {
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

function formatPrice(priceTzs: number): string {
  return `TZS ${new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 }).format(priceTzs)}`;
}

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  const supabase = await createClient();

  // First resolve the slug against the public directory — no existence leak:
  // anything not approved+active returns the same 404.
  const { data: restaurantRow } = await supabase
    .from("public_restaurants")
    .select("*")
    .eq("slug", restaurantSlug.toLowerCase().trim())
    .maybeSingle();

  if (!restaurantRow) {
    notFound();
  }

  // Then fetch the published menu (empty for a restaurant with no published items).
  const { data: raw, error } = await supabase.rpc("get_public_menu", {
    p_slug: restaurantSlug,
  });

  if (error) {
    throw new Error(`Public menu RPC failed: ${error.message}`);
  }

  const rows = (raw ?? []) as unknown as PublicMenuRow[];
  const restaurant = {
    name: restaurantRow.name as string,
    description: restaurantRow.description as string | null,
    logoUrl: restaurantRow.logo_url as string | null,
    contactPhone: restaurantRow.contact_phone as string | null,
    address: [restaurantRow.address_line1, restaurantRow.address_line2].filter(Boolean).join(", "),
    city: (restaurantRow.city as string | null) ?? null,
    region: (restaurantRow.region as string | null) ?? null,
    country: restaurantRow.country_code as string,
  };

  const categories: PublicCategory[] = [];
  const categoryMap = new Map<string, PublicCategory>();

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

  return (
    <main id="main" className="min-h-dvh bg-background text-foreground">
      {/* Hero */}
      <header className="border-b border-border bg-surface-strong">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-6 px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex items-center gap-4">
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurant.logoUrl}
                alt=""
                className="size-16 rounded-2xl border border-border object-cover sm:size-20"
              />
            ) : (
              <div
                aria-hidden="true"
                className="grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground sm:size-20"
              >
                <UtensilsIcon className="size-8" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {restaurant.name}
              </h1>
              {restaurant.description ? (
                <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
                  {restaurant.description}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted">
                {[restaurant.address, restaurant.city, restaurant.region]
                  .filter(Boolean)
                  .join(" · ")}
                {restaurant.contactPhone ? <> · {restaurant.contactPhone}</> : null}
              </p>
            </div>
          </div>
          <Logo className="shrink-0 opacity-90" />
        </div>
      </header>

      {/* Menu */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {categories.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border px-6 py-14 text-center text-sm leading-6 text-muted">
            This restaurant has not published a menu yet.
          </p>
        ) : (
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
        )}

        <p className="mt-12 flex flex-col items-center gap-2 border-t border-border pt-6 text-center text-xs text-muted">
          <span>Public menu preview — ordering opens soon with QR codes per table.</span>
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <QrCodeIcon className="size-4" />
            {siteConfig.tagline}
          </span>
        </p>
      </div>
    </main>
  );
}
