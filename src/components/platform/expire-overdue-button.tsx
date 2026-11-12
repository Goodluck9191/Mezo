"use client";

import { useActionState } from "react";

import { expireOverdueSubscriptionsAction } from "@/app/actions/subscriptions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import type { ActionResult } from "@/lib/validation/auth";

/** Platform-admin action: mark every overdue subscription as expired. */
export function ExpireOverdueButton() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    expireOverdueSubscriptionsAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
      {state?.ok ? (
        <FormSuccessBanner message={state.message ?? "Overdue subscriptions expired."} />
      ) : null}
      <ConfirmButton
        message="Expire every subscription whose renewal date has passed? Restaurants keep their current tables but cannot add new ones until they renew."
        disabled={pending}
        className="h-9 border-amber-600/40 text-amber-800 hover:border-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:text-amber-200 dark:hover:border-amber-400 dark:hover:bg-amber-500/10"
      >
        {pending ? "Expiring…" : "Expire overdue subscriptions"}
      </ConfirmButton>
    </form>
  );
}
