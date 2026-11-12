"use client";

import { useActionState } from "react";

import { setSubscriptionStatusAction } from "@/app/actions/subscriptions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import type { ActionResult } from "@/lib/validation/auth";

type StatusValue = "active" | "past_due" | "expired" | "cancelled";

const LABELS: Record<StatusValue, string> = {
  active: "Mark active",
  past_due: "Mark past due",
  expired: "Mark expired",
  cancelled: "Cancel subscription",
};

const CONFIRM: Record<StatusValue, string> = {
  active:
    "Reactivate this subscription? The restaurant will be able to add tables again, up to its plan limit.",
  past_due: "Mark this subscription as past due? It stays usable but flagged as overdue.",
  expired:
    "Expire this subscription? The restaurant keeps existing tables but cannot add new ones until it is reactivated.",
  cancelled:
    "Cancel this subscription? This is terminal — a new term can only be opened by assigning a plan again.",
};

const BUTTON_STYLES: Partial<Record<StatusValue, string>> = {
  past_due:
    "border-amber-500/40 text-amber-700 hover:border-amber-600 hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-300 dark:hover:border-amber-400 dark:hover:bg-amber-500/10",
  expired:
    "border-amber-600/40 text-amber-800 hover:border-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:text-amber-200 dark:hover:border-amber-400 dark:hover:bg-amber-500/10",
  cancelled:
    "border-red-600/40 text-red-700 hover:border-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-400 dark:hover:border-red-400 dark:hover:bg-red-500/10",
};

export function StatusActions({
  restaurantId,
  currentStatus,
}: {
  restaurantId: string;
  currentStatus: "pending" | "active" | "past_due" | "expired" | "cancelled";
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    setSubscriptionStatusAction,
    undefined,
  );

  // Which transitions make sense from the current status (spec §17.7):
  const allowed: StatusValue[] =
    currentStatus === "pending"
      ? ["active", "expired", "cancelled"]
      : currentStatus === "active"
        ? ["past_due", "expired", "cancelled"]
        : currentStatus === "past_due"
          ? ["active", "expired", "cancelled"]
          : currentStatus === "expired"
            ? ["active", "cancelled"]
            : [];

  if (allowed.length === 0) {
    return (
      <p className="rounded-2xl bg-surface p-3 text-xs leading-5 text-muted">
        This subscription is cancelled — the lifecycle is terminal. Assign a plan again to open a
        new term.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
      {state?.ok ? <FormSuccessBanner message={state.message ?? "Status updated."} /> : null}

      <div className="flex flex-wrap gap-2">
        {allowed.map((status) => {
          const commonProps = {
            message: CONFIRM[status],
            disabled: pending,
            className: BUTTON_STYLES[status],
          };

          return (
            <form key={status} action={formAction} className="inline">
              <input type="hidden" name="restaurantId" value={restaurantId} />
              <input type="hidden" name="status" value={status} />
              {status === "active" ? (
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-accent/40 px-4 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:opacity-50"
                >
                  {pending ? "Working…" : LABELS[status]}
                </button>
              ) : (
                <ConfirmButton {...commonProps}>
                  {pending ? "Working…" : LABELS[status]}
                </ConfirmButton>
              )}
            </form>
          );
        })}
      </div>
    </div>
  );
}
