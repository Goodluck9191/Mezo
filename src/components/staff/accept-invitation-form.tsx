"use client";

import { useActionState, useEffect } from "react";

import { acceptStaffInvitationAction } from "@/app/actions/restaurant";
import { AuthField, FormErrorBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/validation/auth";

export function AcceptInvitationForm({ initialToken }: { initialToken: string | null }) {
  useEffect(() => {
    // Remove the one-time token from the address bar and history as soon as
    // the page mounts. The form below already captured it; nothing else needs
    // it in the URL.
    window.history.replaceState(null, "", "/accept-invite");
  }, []);

  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    acceptStaffInvitationAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}

      <AuthField label="Invitation code" htmlFor="token" required hint="64 hexadecimal characters">
        <Input
          id="token"
          name="token"
          required
          defaultValue={initialToken ?? ""}
          readOnly={Boolean(initialToken)}
          autoComplete="off"
          spellCheck={false}
          placeholder="a3f9c1…"
          className="font-mono text-xs"
        />
      </AuthField>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
    </form>
  );
}
