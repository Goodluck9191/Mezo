"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "@/app/actions/auth";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ActionResult } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    requestPasswordReset,
    undefined,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  if (state?.ok) {
    return (
      <FormSuccessBanner message={state.message ?? "Check your inbox for reset instructions."} />
    );
  }

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}

      <AuthField label="Account email" htmlFor="email" required error={fieldErrors.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          invalid={Boolean(fieldErrors.email)}
          placeholder="you@example.co.tz"
        />
      </AuthField>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
