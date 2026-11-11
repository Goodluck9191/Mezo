"use client";

import { useActionState } from "react";

import { updateProfile } from "@/app/actions/auth";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ActionResult } from "@/lib/validation/auth";

export function EditProfileForm({
  initialFullName,
  initialPhone,
  initialAvatarUrl,
}: {
  initialFullName: string;
  initialPhone: string;
  initialAvatarUrl: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    updateProfile,
    undefined,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
      {state?.ok ? <FormSuccessBanner message={state.message ?? "Profile updated."} /> : null}

      <AuthField label="Full name" htmlFor="fullName" required error={fieldErrors.fullName?.[0]}>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={initialFullName}
          required
          invalid={Boolean(fieldErrors.fullName)}
          autoComplete="name"
        />
      </AuthField>

      <AuthField
        label="Phone"
        htmlFor="phone"
        error={fieldErrors.phone?.[0]}
        hint="Optional — e.g. +255700000000"
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={initialPhone}
          invalid={Boolean(fieldErrors.phone)}
          autoComplete="tel"
          placeholder="+255700000000"
        />
      </AuthField>

      <AuthField
        label="Avatar URL"
        htmlFor="avatarUrl"
        error={fieldErrors.avatarUrl?.[0]}
        hint="Optional — hosted link starting with https://"
      >
        <Input
          id="avatarUrl"
          name="avatarUrl"
          type="url"
          defaultValue={initialAvatarUrl}
          invalid={Boolean(fieldErrors.avatarUrl)}
          placeholder="https://example.com/avatar.jpg"
        />
      </AuthField>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
