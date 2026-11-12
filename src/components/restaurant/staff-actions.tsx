"use client";

import { useActionState } from "react";

import { deactivateMemberAction, revokeInvitationAction } from "@/app/actions/restaurant";
import { ConfirmButton } from "@/components/shared/confirm-button";
import type { ActionResult } from "@/lib/validation/auth";

/**
 * Small per-row action islands. Each keeps its own pending/error state so a
 * failed action on one row does not affect the rest of the list.
 */
export function DeactivateMemberButton({
  restaurantId,
  memberId,
  memberName,
}: {
  restaurantId: string;
  memberId: string;
  memberName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    deactivateMemberAction,
    undefined,
  );

  if (state?.ok) {
    return (
      <span role="status" className="text-xs font-medium text-accent">
        Deactivated
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <input type="hidden" name="memberId" value={memberId} />
      <ConfirmButton
        message={`Deactivate ${memberName}? They will lose access immediately and can be re-invited later.`}
        disabled={pending}
      >
        {pending ? "Deactivating…" : "Deactivate"}
      </ConfirmButton>
      {state && !state.ok ? (
        <p
          role="alert"
          className="max-w-56 text-right text-[11px] leading-4 text-red-600 dark:text-red-400"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function RevokeInvitationButton({
  restaurantId,
  invitationId,
  inviteeEmail,
}: {
  restaurantId: string;
  invitationId: string;
  inviteeEmail: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    revokeInvitationAction,
    undefined,
  );

  if (state?.ok) {
    return (
      <span role="status" className="text-xs font-medium text-accent">
        Revoked
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <ConfirmButton
        message={`Revoke the invitation for ${inviteeEmail}? They will not be able to join with that link.`}
        disabled={pending}
      >
        {pending ? "Revoking…" : "Revoke"}
      </ConfirmButton>
      {state && !state.ok ? (
        <p
          role="alert"
          className="max-w-56 text-right text-[11px] leading-4 text-red-600 dark:text-red-400"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
