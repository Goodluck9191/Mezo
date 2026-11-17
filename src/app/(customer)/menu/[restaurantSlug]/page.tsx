import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import { QrCodeIcon, UtensilsIcon } from "@/components/ui/icons";
import {
  buildCategories,
  PublicMenuView,
  type PublicMenuRow,
} from "@/components/menu/public-menu-view";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu",
  description: `Browse restaurants on ${siteConfig.name}.`,
};

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

  const categories = buildCategories(rows);

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
        <PublicMenuView categories={categories} />

        <p className="mt-12 flex flex-col items-center gap-2 border-t border-border pt-6 text-center text-xs text-muted">
          <span>
            Scan the QR code at your table and order once your waiter approves your seating.
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <QrCodeIcon className="size-4" />
            {siteConfig.tagline}
          </span>
        </p>
      </div>
    </main>
  );
}
