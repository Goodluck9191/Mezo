"use client";

import { useActionState } from "react";

import { reviewApplicationAction } from "@/app/actions/auth";
import { FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { cn } from "@/utils/cn";

import type { ActionResult } from "@/lib/validation/auth";

type Plan = {
  id: string;
  code: string;
  name: string;
  table_limit: number;
  price_tzs: number;
};

export function ApplicationReviewForm({
  applicationId,
  restaurantName,
  plans,
}: {
  applicationId: string;
  restaurantName: string;
  plans: Plan[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    reviewApplicationAction,
    undefined,
  );

  if (state?.ok) {
    return <FormSuccessBanner message={state.message ?? "Done."} />;
  }

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
      <input type="hidden" name="applicationId" value={applicationId} />

      <fieldset className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <legend className="sr-only">Decision for {restaurantName}</legend>

        <div className="flex items-center gap-3">
          <label
            htmlFor="decision"
            className="text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Decision
          </label>
          <Select name="decision" id="decision" defaultValue="approved" className="w-auto">
            <option value="approved">Approve</option>
            <option value="rejected">Reject</option>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            className={cn("w-full sm:w-auto")}
          >
            {pending ? "Submitting…" : "Submit decision"}
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="plan"
            className="text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Plan on approval
          </label>
          <Select name="plan" id="plan">
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.table_limit} tables ({plan.price_tzs.toLocaleString()} TZS)
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="reason"
            className="text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Reason if rejecting
          </label>
          <Textarea
            name="reason"
            id="reason"
            placeholder="Missing restaurant details…"
            className="min-h-[4.5rem]"
          />
        </div>
      </div>
    </form>
  );
}
