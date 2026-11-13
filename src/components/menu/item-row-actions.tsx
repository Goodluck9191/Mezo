"use client";

import { useActionState } from "react";

import {
  archiveItemAction,
  restoreItemAction,
  setItemAvailabilityAction,
} from "@/app/actions/menu";
import type { ActionResult } from "@/lib/validation/auth";

/** Availability toggle for one item row — reports its result inline. */
export function ItemAvailabilityButton({
  itemId,
  isAvailable,
}: {
  itemId: string;
  isAvailable: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    setItemAvailabilityAction,
    undefined,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="isAvailable" value={isAvailable ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted transition-colors hover:bg-surface hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "…" : isAvailable ? "Mark unavailable" : "Mark available"}
      </button>
      {state && !state.ok ? (
        <span role="alert" className="ml-1 text-[10px] text-red-600 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

/** Archive/restore for one item row. */
export function ItemArchiveButton({ itemId, archived }: { itemId: string; archived: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    archived ? restoreItemAction : archiveItemAction,
    undefined,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className={
          archived
            ? "rounded-full border border-accent/40 px-2.5 py-1 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:opacity-50"
            : "rounded-full border border-amber-500/40 px-2.5 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
        }
      >
        {pending ? "…" : archived ? "Restore" : "Archive"}
      </button>
      {state && !state.ok ? (
        <span role="alert" className="ml-1 text-[10px] text-red-600 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
