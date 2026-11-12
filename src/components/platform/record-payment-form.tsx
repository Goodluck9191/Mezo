"use client";

import { useActionState } from "react";

import { recordSubscriptionPaymentAction } from "@/app/actions/subscriptions";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/validation/auth";

export function RecordPaymentForm({ restaurantId }: { restaurantId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    recordSubscriptionPaymentAction,
    undefined,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
      {state?.ok ? <FormSuccessBanner message={state.message ?? "Payment recorded."} /> : null}
      <input type="hidden" name="restaurantId" value={restaurantId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          label="Amount (TZS)"
          htmlFor="payment-amount"
          required
          error={fieldErrors.amountTzs?.[0]}
        >
          <Input
            id="payment-amount"
            name="amountTzs"
            type="number"
            min={0}
            step={1}
            required
            placeholder="85000"
            className="tabular-nums"
            invalid={Boolean(fieldErrors.amountTzs)}
          />
        </AuthField>
        <AuthField label="Status" htmlFor="payment-status" required error={fieldErrors.status?.[0]}>
          <Select
            id="payment-status"
            name="status"
            defaultValue="successful"
            invalid={Boolean(fieldErrors.status)}
          >
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </Select>
        </AuthField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          label="Reference"
          htmlFor="payment-reference"
          error={fieldErrors.providerReference?.[0]}
          hint="Idempotency key"
        >
          <Input
            id="payment-reference"
            name="providerReference"
            placeholder="e.g. SN-2026-000123"
            invalid={Boolean(fieldErrors.providerReference)}
            autoComplete="off"
          />
        </AuthField>
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            label="Period start"
            htmlFor="payment-period-start"
            error={fieldErrors.periodStartsOn?.[0]}
          >
            <Input
              id="payment-period-start"
              name="periodStartsOn"
              type="date"
              invalid={Boolean(fieldErrors.periodStartsOn)}
            />
          </AuthField>
          <AuthField
            label="Period end"
            htmlFor="payment-period-end"
            error={fieldErrors.periodEndsOn?.[0]}
          >
            <Input
              id="payment-period-end"
              name="periodEndsOn"
              type="date"
              invalid={Boolean(fieldErrors.periodEndsOn)}
            />
          </AuthField>
        </div>
      </div>

      <AuthField
        label="Failure reason"
        htmlFor="payment-failure-reason"
        error={fieldErrors.failureReason?.[0]}
        hint="Only for failed payments"
      >
        <Textarea
          id="payment-failure-reason"
          name="failureReason"
          maxLength={500}
          invalid={Boolean(fieldErrors.failureReason)}
        />
      </AuthField>

      <Button type="submit" size="md" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
      <p className="text-xs leading-5 text-muted">
        Manual entry for operator-collected payments. Snippe webhooks are not connected in this
        phase; no payment is trusted from the browser.
      </p>
    </form>
  );
}
