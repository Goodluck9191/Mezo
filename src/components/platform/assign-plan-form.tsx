"use client";

import { useActionState } from "react";

import { assignSubscriptionPlanAction } from "@/app/actions/subscriptions";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { ActionResult } from "@/lib/validation/auth";

export function AssignPlanForm({
  restaurantId,
  plans,
}: {
  restaurantId: string;
  plans: Array<{ id: string; name: string; tableLimit: number; billingInterval: string }>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    assignSubscriptionPlanAction,
    undefined,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
      {state?.ok ? <FormSuccessBanner message={state.message ?? "Plan assigned."} /> : null}
      <input type="hidden" name="restaurantId" value={restaurantId} />

      <AuthField label="Plan" htmlFor="assign-plan-id" required error={fieldErrors.planId?.[0]}>
        <Select id="assign-plan-id" name="planId" required invalid={Boolean(fieldErrors.planId)}>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {plan.tableLimit} tables ·{" "}
              {plan.billingInterval === "yearly" ? "Yearly" : "Monthly"}
            </option>
          ))}
        </Select>
      </AuthField>

      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          label="Start date"
          htmlFor="assign-starts-on"
          error={fieldErrors.startsOn?.[0]}
          hint="Optional"
        >
          <Input
            id="assign-starts-on"
            name="startsOn"
            type="date"
            invalid={Boolean(fieldErrors.startsOn)}
          />
        </AuthField>
        <AuthField
          label="Renewal date"
          htmlFor="assign-renews-on"
          error={fieldErrors.renewsOn?.[0]}
          hint="Defaults to one period from start"
        >
          <Input
            id="assign-renews-on"
            name="renewsOn"
            type="date"
            invalid={Boolean(fieldErrors.renewsOn)}
          />
        </AuthField>
      </div>

      <Button type="submit" size="md" disabled={pending}>
        {pending ? "Assigning…" : "Assign plan"}
      </Button>
    </form>
  );
}
