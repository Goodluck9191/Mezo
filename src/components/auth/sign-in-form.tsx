"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";

import { signIn } from "@/app/actions/auth";
import { AuthField, FormErrorBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ActionResult } from "@/lib/validation/auth";

export function SignInForm({ next }: { next?: string }) {
  useEffect(() => {
    // If the sign-in page was reached with an invitation-bearing `next`, the
    // token is now captured in the hidden form field — scrub it from the
    // address bar so it never lingers in browser history.
    if (next && next.startsWith("/accept-invite")) {
      window.history.replaceState(null, "", "/login");
    }
  }, [next]);

  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    signIn,
    undefined,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}

      <AuthField label="Email" htmlFor="email" required error={fieldErrors.email?.[0]}>
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

      <AuthField label="Password" htmlFor="password" required error={fieldErrors.password?.[0]}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          invalid={Boolean(fieldErrors.password)}
          placeholder="••••••••"
        />
      </AuthField>

      <div className="flex items-center justify-between gap-4 text-sm">
        <Link
          href="/forgot-password"
          className="text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
