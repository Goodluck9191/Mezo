"use client";

import { useActionState } from "react";

import { signUp } from "@/app/actions/auth";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ActionResult } from "@/lib/validation/auth";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    signUp,
    undefined,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  if (state?.ok) {
    return (
      <FormSuccessBanner message={state.message ?? "Check your inbox for a verification link."} />
    );
  }

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}

      <AuthField label="Full name" htmlFor="fullName" required error={fieldErrors.fullName?.[0]}>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          autoFocus
          required
          aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
          invalid={Boolean(fieldErrors.fullName)}
          placeholder="Asha Mrema"
        />
      </AuthField>

      <AuthField label="Email" htmlFor="email" required error={fieldErrors.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          invalid={Boolean(fieldErrors.email)}
          placeholder="you@example.co.tz"
        />
      </AuthField>

      <AuthField
        label="Password"
        htmlFor="password"
        required
        error={fieldErrors.password?.[0]}
        hint="8+ chars, 1 letter, 1 number"
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          invalid={Boolean(fieldErrors.password)}
          placeholder="••••••••"
        />
      </AuthField>

      <AuthField
        label="Confirm password"
        htmlFor="confirmPassword"
        required
        error={fieldErrors.confirmPassword?.[0]}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
          invalid={Boolean(fieldErrors.confirmPassword)}
          placeholder="••••••••"
        />
      </AuthField>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
