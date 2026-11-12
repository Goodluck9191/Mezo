"use client";

import { useActionState } from "react";

import { setPlanActiveAction, updateSubscriptionPlanAction } from "@/app/actions/subscriptions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { FormErrorBanner } from "@/components/auth/auth-form-parts";
import type { ActionResult } from "@/lib/validation/auth";

/** Row editor for an existing plan. Price/table limit save independently. */
export function PlanRowEditor({
  planId,
  name,
  description,
  priceTzs,
  billingInterval,
  tableLimit,
  isActive,
}: {
  planId: string;
  name: string;
  description: string;
  priceTzs: number;
  billingInterval: "monthly" | "yearly";
  tableLimit: number;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    updateSubscriptionPlanAction,
    undefined,
  );

  const [toggleState, toggleAction, togglePending] = useActionState<
    ActionResult | undefined,
    FormData
  >(setPlanActiveAction, undefined);

  return (
    <div className="space-y-3">
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
      {state?.ok ? (
        <p role="status" className="text-xs font-medium text-accent">
          {state.message}
        </p>
      ) : null}
      {toggleState && !toggleState.ok ? <FormErrorBanner message={toggleState.error} /> : null}

      <form
        action={formAction}
        className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_9rem_8rem_auto] lg:items-end"
        aria-busy={pending}
      >
        <input type="hidden" name="planId" value={planId} />
        <div className="min-w-0">
          <label htmlFor={`plan-name-${planId}`} className="sr-only">
            Name
          </label>
          <input
            id={`plan-name-${planId}`}
            name="name"
            defaultValue={name}
            required
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor={`plan-price-${planId}`} className="sr-only">
            Price (TZS)
          </label>
          <input
            id={`plan-price-${planId}`}
            name="priceTzs"
            type="number"
            min={0}
            step={1}
            defaultValue={priceTzs}
            required
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm tabular-nums"
            aria-label="Price in TZS"
          />
        </div>
        <div>
          <label htmlFor={`plan-billing-${planId}`} className="sr-only">
            Billing interval
          </label>
          <select
            id={`plan-billing-${planId}`}
            name="billingInterval"
            defaultValue={billingInterval}
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            aria-label="Billing interval"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label htmlFor={`plan-limit-${planId}`} className="sr-only">
            Table limit
          </label>
          <input
            id={`plan-limit-${planId}`}
            name="tableLimit"
            type="number"
            min={1}
            max={10000}
            step={1}
            defaultValue={tableLimit}
            required
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm tabular-nums"
            aria-label="Table limit"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-xs font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>

      <form
        action={toggleAction}
        className="flex items-center justify-between gap-3 border-t border-border pt-2"
        aria-busy={togglePending}
      >
        <input type="hidden" name="planId" value={planId} />
        <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
        <p className="text-xs leading-5 text-muted">{description || "No description."}</p>
        {isActive ? (
          <ConfirmButton
            message="Deactivate this plan? Restaurants keep their current terms but the plan will be hidden from the public catalogue and cannot be assigned to new restaurants."
            disabled={togglePending}
          >
            {togglePending ? "Deactivating…" : "Deactivate plan"}
          </ConfirmButton>
        ) : (
          <button
            type="submit"
            disabled={togglePending}
            className="inline-flex h-9 items-center justify-center rounded-full border border-accent/40 px-4 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {togglePending ? "Activating…" : "Reactivate plan"}
          </button>
        )}
      </form>
    </div>
  );
}
