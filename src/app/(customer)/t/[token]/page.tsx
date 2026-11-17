import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { QrCodeIcon, UtensilsIcon } from "@/components/ui/icons";
import {
  buildCategories,
  PublicMenuView,
  type PublicMenuRow,
} from "@/components/menu/public-menu-view";
import { TableAccessPanel, type TableAccessStatus } from "@/components/customer/table-access-panel";
import { createClient } from "@/lib/supabase/server";
import { isQrToken } from "@/lib/qr";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your table",
  description: `Scan, sit, and order on ${siteConfig.name}.`,
  robots: { index: false, follow: false },
};

interface TableEntryRow {
  restaurant_name: string;
  restaurant_slug: string;
  restaurant_description: string | null;
  restaurant_logo_url: string | null;
  table_name: string;
  has_active_session: boolean;
  my_status: string;
}

const STATUS_VALUES = new Set<TableAccessStatus>([
  "none",
  "pending",
  "approved",
  "rejected",
  "expired",
  "cancelled",
  "closed",
]);

function toAccessStatus(value: string): TableAccessStatus {
  return (STATUS_VALUES.has(value as TableAccessStatus) ? value : "none") as TableAccessStatus;
}

function entryErrorMessage(message: string): string {
  if (message.includes("restaurant")) {
    return "This restaurant is not accepting orders right now.";
  }
  if (message.includes("table is not accepting")) {
    return "This table is not accepting orders right now.";
  }
  return "This QR code is invalid or has been deactivated.";
}

function InvalidQr({ message }: { message: string }) {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center"
    >
      <Logo />
      <div className="mt-8 grid size-16 place-items-center rounded-3xl border border-border bg-surface">
        <QrCodeIcon className="size-8 text-muted" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Can&apos;t open this table</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{message}</p>
      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {siteConfig.tagline}
      </p>
    </main>
  );
}

export default async function TableEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const token = rawToken.toLowerCase();

  if (!isQrToken(token)) {
    return <InvalidQr message="This QR code is invalid or has been deactivated." />;
  }

  const supabase = await createClient();

  // Validate the token and resolve the restaurant + table. Anything else —
  // revoked, regenerated, or cross-restaurant — fails the same way.
  const { data: entryRaw, error: entryError } = await supabase.rpc("get_table_entry", {
    p_qr_token: token,
  });

  if (entryError || !entryRaw) {
    return <InvalidQr message={entryErrorMessage(entryError?.message ?? "")} />;
  }

  const entry = (Array.isArray(entryRaw) ? entryRaw[0] : entryRaw) as unknown as TableEntryRow;

  // The public menu stays visible either way; ordering permissions are not
  // granted by viewing it.
  const { data: menuRaw } = await supabase.rpc("get_public_menu", {
    p_slug: entry.restaurant_slug,
  });
  const menuRows = ((menuRaw ?? []) as unknown as PublicMenuRow[]) ?? [];
  const categories = buildCategories(menuRows);

  return (
    <main id="main" className="min-h-dvh bg-background text-foreground">
      {/* Restaurant header */}
      <header className="border-b border-border bg-surface-strong">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-6 sm:px-6">
          {entry.restaurant_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.restaurant_logo_url}
              alt=""
              className="size-14 shrink-0 rounded-2xl border border-border object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"
            >
              <UtensilsIcon className="size-7" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Dining room
            </p>
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {entry.restaurant_name}
            </h1>
          </div>
          <span className="shrink-0 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-2 text-center">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">
              Table
            </span>
            <span className="block text-lg font-bold leading-tight text-accent">
              {entry.table_name}
            </span>
          </span>
        </div>
      </header>

      {/* Access state */}
      <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6">
        <TableAccessPanel
          token={token}
          tableName={entry.table_name}
          initialStatus={toAccessStatus(entry.my_status)}
        />
      </div>

      {/* Menu */}
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-6 sm:px-6">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <h2 className="text-lg font-semibold tracking-tight">Menu</h2>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Browse freely
          </span>
        </div>
        <div className="mt-4">
          <PublicMenuView categories={categories} />
        </div>
      </div>
    </main>
  );
}
