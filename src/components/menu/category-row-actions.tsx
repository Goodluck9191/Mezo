"use client";

import { useActionState } from "react";

import {
  archiveCategoryAction,
  restoreCategoryAction,
  setCategoryActiveAction,
} from "@/app/actions/menu";
import type { ActionResult } from "@/lib/validation/auth";

/** Active/hidden toggle for one category row. */
export function CategoryActiveToggle({
  categoryId,
  isActive,
}: {
  categoryId: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    setCategoryActiveAction,
    undefined,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className={
          isActive
            ? "inline-flex h-8 items-center rounded-full bg-accent/10 px-3 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20 disabled:pointer-events-none disabled:opacity-50"
            : "inline-flex h-8 items-center rounded-full bg-surface px-3 text-[11px] font-medium text-muted transition-colors hover:bg-accent/5 hover:text-accent disabled:pointer-events-none disabled:opacity-50"
        }
      >
        {pending ? "…" : isActive ? "Visible" : "Hidden"}
      </button>
      {state && !state.ok ? (
        <span role="alert" className="ml-1 text-[10px] text-red-600 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

/** Archive/restore for one category row. */
export function CategoryArchiveButton({
  categoryId,
  archived,
}: {
  categoryId: string;
  archived: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    archived ? restoreCategoryAction : archiveCategoryAction,
    undefined,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="categoryId" value={categoryId} />
      <button
        type="submit"
        disabled={pending}
        className={
          archived
            ? "inline-flex h-8 items-center gap-1 rounded-full border border-accent/40 px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:opacity-50"
            : "inline-flex h-8 items-center rounded-full border border-amber-500/40 px-3 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
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
