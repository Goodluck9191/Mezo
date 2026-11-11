"use client";

import { useActionState } from "react";

import { applyForRestaurantAction } from "@/app/actions/auth";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

import type { ActionResult } from "@/lib/validation/auth";

export function ApplyForRestaurantForm() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    applyForRestaurantAction,
    undefined,
  );

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  if (state?.ok) {
    return <FormSuccessBanner message={state.message ?? "Application submitted."} />;
  }

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <AuthField label="Restaurant name" htmlFor="name" required error={fieldErrors.name?.[0]}>
          <Input
            id="name"
            name="name"
            autoFocus
            required
            placeholder="Coastal Grill"
            invalid={Boolean(fieldErrors.name)}
          />
        </AuthField>

        <AuthField
          label="Web address"
          htmlFor="slug"
          required
          error={fieldErrors.slug?.[0]}
          hint="mezo.app/coastal-grill"
        >
          <Input
            id="slug"
            name="slug"
            required
            placeholder="coastal-grill"
            invalid={Boolean(fieldErrors.slug)}
          />
        </AuthField>
      </div>

      <AuthField
        label="Short description"
        htmlFor="description"
        error={fieldErrors.description?.[0]}
      >
        <Textarea
          id="description"
          name="description"
          placeholder="What your restaurant is known for"
        />
      </AuthField>

      <div className="grid gap-5 sm:grid-cols-2">
        <AuthField
          label="Email"
          htmlFor="contactEmail"
          required
          error={fieldErrors.contactEmail?.[0]}
        >
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            placeholder="ops@coastalgrill.co.tz"
            invalid={Boolean(fieldErrors.contactEmail)}
            autoComplete="email"
          />
        </AuthField>

        <AuthField
          label="Phone"
          htmlFor="contactPhone"
          required
          error={fieldErrors.contactPhone?.[0]}
          hint="e.g. +255712345678"
        >
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            required
            placeholder="+255712345678"
            invalid={Boolean(fieldErrors.contactPhone)}
            autoComplete="tel"
          />
        </AuthField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <AuthField label="City" htmlFor="city" error={fieldErrors.city?.[0]}>
          <Input id="city" name="city" placeholder="Dar es Salaam" />
        </AuthField>

        <AuthField label="Region" htmlFor="region" error={fieldErrors.region?.[0]}>
          <Input id="region" name="region" placeholder="Dar es Salaam" />
        </AuthField>
      </div>

      <AuthField
        label="Message for the review team"
        htmlFor="message"
        error={fieldErrors.message?.[0]}
        hint="Optional"
      >
        <Textarea
          id="message"
          name="message"
          placeholder="Location, floor size, where you found us…"
        />
      </AuthField>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
