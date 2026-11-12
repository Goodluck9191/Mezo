"use client";

import { useActionState, useState } from "react";

import { inviteStaffAction, type InviteStaffResult } from "@/app/actions/restaurant";
import { AuthField, FormErrorBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export function InviteStaffForm({
  restaurantId,
  appUrl,
}: {
  restaurantId: string;
  appUrl: string;
}) {
  const [state, formAction, pending] = useActionState<InviteStaffResult | undefined, FormData>(
    inviteStaffAction,
    undefined,
  );
  const [copied, setCopied] = useState(false);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const invite = state?.ok ? state.invite : null;
  const acceptUrl = invite
    ? `${appUrl.replace(/\/$/, "")}/accept-invite?token=${invite.token}`
    : null;

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4" aria-busy={pending}>
        {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
        <input type="hidden" name="restaurantId" value={restaurantId} />

        <div className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <AuthField
            label="Email address"
            htmlFor="invite-email"
            required
            error={fieldErrors.email?.[0]}
            hint="They sign in with this email"
          >
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="waiter@coastalgrill.co.tz"
              invalid={Boolean(fieldErrors.email)}
              autoComplete="off"
            />
          </AuthField>

          <AuthField label="Role" htmlFor="invite-role" required error={fieldErrors.role?.[0]}>
            <Select
              id="invite-role"
              name="role"
              defaultValue="waiter"
              invalid={Boolean(fieldErrors.role)}
            >
              <option value="waiter">Waiter</option>
              <option value="kitchen">Kitchen</option>
            </Select>
          </AuthField>

          <Button type="submit" size="md" className="sm:mb-0.5" disabled={pending}>
            {pending ? "Creating…" : "Create invite"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted">
          Roles you can grant: waiter or kitchen. restaurant_admin is granted at platform review and
          can never be assigned here.
        </p>
      </form>

      {invite && acceptUrl ? (
        <div
          role="status"
          className="rounded-2xl border border-accent/25 bg-accent/5 p-4 text-sm leading-6"
        >
          <p className="font-medium text-foreground">Invitation for {invite.email} created.</p>
          <p className="mt-1 text-xs text-muted">
            No email is sent from this environment. Deliver this one-time link to them privately; it
            expires in 7 days.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="block max-w-full overflow-x-auto rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground">
              {acceptUrl}
            </code>
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-border px-4 text-xs font-medium text-foreground transition-colors hover:bg-surface"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(acceptUrl);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
