import Link from "next/link";

import { ItemAvailabilityButton, ItemArchiveButton } from "@/components/menu/item-row-actions";
import type { ItemSummary } from "@/lib/menu";
import { formatTzs } from "@/lib/subscriptions-shared";

/** Items table with search + category filter applied server-side (query string). */
export function ItemsTable({ items, slug }: { items: ItemSummary[]; slug: string }) {
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border bg-surface px-6 py-10 text-center text-sm leading-6 text-muted">
        No items match. Create your first item from{" "}
        <Link
          href={`/restaurant/menu/items/new?restaurant=${encodeURIComponent(slug)}`}
          className="font-medium text-accent hover:underline"
        >
          Add item
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Item
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Category
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Price
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Status
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border/60 last:border-0 align-middle">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="size-10 rounded-xl border border-border object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="grid size-10 place-items-center rounded-xl border border-border bg-surface text-[10px] font-semibold text-muted"
                    >
                      —
                    </div>
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{item.name}</span>
                    {item.description ? (
                      <span className="mt-0.5 line-clamp-1 block text-[11px] text-muted">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </div>
              </td>
              <td className="py-3 pr-4 text-xs text-muted">{item.categoryName}</td>
              <td className="py-3 pr-4 tabular-nums text-xs text-muted">
                {formatTzs(item.priceTzs)}
              </td>
              <td className="py-3 pr-4">
                {item.archivedAt ? (
                  <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Archived
                  </span>
                ) : item.isAvailable ? (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Available
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    Unavailable
                  </span>
                )}
              </td>
              <td className="py-3 text-right">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!item.archivedAt ? (
                    <>
                      <ItemAvailabilityButton itemId={item.id} isAvailable={item.isAvailable} />
                      <Link
                        href={`/restaurant/menu/items/${item.id}/edit?restaurant=${encodeURIComponent(slug)}`}
                        className="rounded-full border border-accent/40 px-2.5 py-1 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/10"
                      >
                        Edit
                      </Link>
                      <ItemArchiveButton itemId={item.id} archived={false} />
                    </>
                  ) : (
                    <ItemArchiveButton itemId={item.id} archived />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
