"use client";

import { useActionState } from "react";
import Link from "next/link";

import { updatePassword } from "@/app/actions/auth";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ActionResult } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    updatePassword,
    undefined,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <FormSuccessBanner message={state.message ?? "Password updated. You can now sign in."} />
        <Link href="/login" className="block">
          <Button className="w-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}

      <AuthField
        label="New password"
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
          autoFocus
          required
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          invalid={Boolean(fieldErrors.password)}
          placeholder="••••••••"
        />
      </AuthField>

      <AuthField
        label="Confirm new password"
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
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
