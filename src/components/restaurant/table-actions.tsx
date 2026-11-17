"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createTableAction,
  regenerateQrAction,
  setTableActiveAction,
  type CreateTableResult,
} from "@/app/actions/table-access";
import { QrReveal, ConfirmInline, type TableQr } from "@/components/restaurant/table-qr";
import type { AdminTableRow } from "@/lib/table-access";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";

/** Add-table form with plan-limit awareness. */
export function AddTableForm({
  restaurantId,
  remainingTables,
  tableLimit,
}: {
  restaurantId: string;
  remainingTables: number | null;
  tableLimit: number | null;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<CreateTableResult | undefined, FormData>(
    createTableAction,
    undefined,
  );
  // Dismissal is tracked by identity — no effect needed to sync the reveal.
  const [dismissedQr, setDismissedQr] = useState<TableQr | null>(null);
  const qr = state?.ok && state.qr && state.qr !== dismissedQr ? state.qr : null;

  const handleSubmit = async (formData: FormData) => {
    setDismissedQr(null);
    await formAction(formData);
    router.refresh();
  };

  const atLimit = remainingTables !== null && remainingTables <= 0;

  return (
    <div>
      {qr ? (
        <QrReveal qr={qr} heading="New table — QR code" onDismiss={() => setDismissedQr(qr)} />
      ) : null}

      <form action={handleSubmit} className="mt-1 grid gap-3">
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <div>
          <label
            htmlFor="table-name"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
          >
            Table name
          </label>
          <input
            id="table-name"
            name="name"
            type="text"
            required
            maxLength={40}
            placeholder="Table 12"
            className="mt-1.5 h-11 w-full rounded-2xl border border-border bg-surface-strong px-4 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {state && !state.ok && state.fieldErrors?.name ? (
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              {state.fieldErrors.name[0]}
            </p>
          ) : null}
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-xs leading-5 text-red-700 dark:text-red-300">
            {state.error}
          </p>
        ) : null}
        {state?.ok && !qr ? (
          <p role="status" className="text-xs leading-5 text-emerald-700 dark:text-emerald-300">
            Table created. Its QR code was shown above.
          </p>
        ) : null}

        <Button type="submit" disabled={isPending || atLimit} className="h-11 w-full">
          {isPending ? "Adding table…" : "Add table"}
        </Button>
        {tableLimit !== null ? (
          <p className="text-center text-[11px] leading-4 text-muted">
            {atLimit
              ? `Plan limit of ${tableLimit} tables reached. Upgrade to add more.`
              : `${remainingTables} of ${tableLimit} tables on your plan remaining.`}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/** Row actions for one table: regenerate QR (admin) and activate/deactivate. */
export function TableRowActions({ table }: { table: AdminTableRow }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"regenerate" | "toggle" | null>(null);
  const [qr, setQr] = useState<TableQr | null>(null);
  const [error, setError] = useState<string | null>(null);

  const regenerate = async () => {
    setBusy("regenerate");
    setError(null);
    try {
      const result = await regenerateQrAction(table.id);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setQr(result.qr);
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Could not regenerate the QR code.");
      setConfirming(false);
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async () => {
    setBusy("toggle");
    setError(null);
    try {
      const result = await setTableActiveAction(table.id, !table.isActive);
      if (!result.ok) {
        setError(result.error ?? "Could not update the table.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update the table.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy !== null || confirming}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "disabled:opacity-50",
          )}
        >
          Regenerate QR
        </button>
        <button
          type="button"
          onClick={() => void toggleActive()}
          disabled={busy !== null}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "disabled:opacity-50")}
        >
          {busy === "toggle" ? "Saving…" : table.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>

      {confirming ? (
        <ConfirmInline
          question="This invalidates the printed code. Continue?"
          confirmLabel="Regenerate"
          busy={busy === "regenerate"}
          onConfirm={() => void regenerate()}
          onCancel={() => setConfirming(false)}
        />
      ) : null}

      {qr ? (
        <QrReveal qr={qr} heading="Regenerated — QR code" onDismiss={() => setQr(null)} />
      ) : null}
      {error ? (
        <p role="alert" className="text-right text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
