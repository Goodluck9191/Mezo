"use client";

import { useActionState } from "react";

import { resendConfirmationEmail } from "@/app/actions/auth";
import { FormErrorBanner, FormSuccessBanner, AuthField } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ActionResult } from "@/lib/validation/auth";

export function ResendConfirmationForm() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    resendConfirmationEmail,
    undefined,
  );

  if (state?.ok) {
    return (
      <FormSuccessBanner message={state.message ?? "If that account exists, we sent a new link."} />
    );
  }

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}

      <AuthField label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.co.tz"
        />
      </AuthField>

      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Resend verification email"}
      </Button>
    </form>
  );
}
