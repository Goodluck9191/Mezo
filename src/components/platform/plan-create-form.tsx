"use client";

import { useActionState } from "react";

import { createSubscriptionPlanAction } from "@/app/actions/subscriptions";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/validation/auth";

export function PlanCreateForm() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    createSubscriptionPlanAction,
    undefined,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
      {state?.ok ? <FormSuccessBanner message={state.message ?? "Plan created."} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          label="Code"
          htmlFor="code"
          required
          error={fieldErrors.code?.[0]}
          hint="e.g. business_monthly"
        >
          <Input
            id="code"
            name="code"
            required
            placeholder="business_monthly"
            invalid={Boolean(fieldErrors.code)}
            autoComplete="off"
          />
        </AuthField>
        <AuthField label="Name" htmlFor="name" required error={fieldErrors.name?.[0]}>
          <Input
            id="name"
            name="name"
            required
            placeholder="Business"
            invalid={Boolean(fieldErrors.name)}
            autoComplete="off"
          />
        </AuthField>
      </div>

      <AuthField
        label="Description"
        htmlFor="description"
        error={fieldErrors.description?.[0]}
        hint="Mark placeholder pricing clearly"
      >
        <Textarea
          id="description"
          name="description"
          maxLength={1000}
          placeholder="What this tier includes and that pricing is a placeholder."
          invalid={Boolean(fieldErrors.description)}
        />
      </AuthField>

      <div className="grid gap-4 sm:grid-cols-3">
        <AuthField
          label="Price (TZS)"
          htmlFor="priceTzs"
          required
          error={fieldErrors.priceTzs?.[0]}
          hint="0 = custom pricing"
        >
          <Input
            id="priceTzs"
            name="priceTzs"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            required
            placeholder="0"
            invalid={Boolean(fieldErrors.priceTzs)}
          />
        </AuthField>
        <AuthField
          label="Billing interval"
          htmlFor="billingInterval"
          required
          error={fieldErrors.billingInterval?.[0]}
        >
          <Select
            id="billingInterval"
            name="billingInterval"
            defaultValue="monthly"
            invalid={Boolean(fieldErrors.billingInterval)}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </AuthField>
        <AuthField
          label="Table limit"
          htmlFor="tableLimit"
          required
          error={fieldErrors.tableLimit?.[0]}
        >
          <Input
            id="tableLimit"
            name="tableLimit"
            type="number"
            min={1}
            max={10000}
            step={1}
            inputMode="numeric"
            required
            placeholder="20"
            invalid={Boolean(fieldErrors.tableLimit)}
          />
        </AuthField>
      </div>

      <fieldset className="rounded-2xl border border-border p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Visibility
        </legend>
        <p className="text-xs leading-5 text-muted">
          Active plans are visible in the public catalogue and assignable to new restaurants.
          Deactivated plans stay assigned to their current restaurants but cannot be given to new
          ones.
        </p>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="isActive" value="true" defaultChecked />
            Active
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="isActive" value="false" />
            Inactive
          </label>
        </div>
      </fieldset>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create plan"}
      </Button>
    </form>
  );
}
