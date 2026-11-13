"use client";

import { useActionState } from "react";

import { createCategoryAction, updateCategoryAction } from "@/app/actions/menu";
import { FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/validation/auth";

export function CategoryCreateForm({ restaurantId }: { restaurantId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    createCategoryAction,
    undefined,
  );
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form
      action={formAction}
      className="rounded-3xl border border-border bg-surface-strong p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-sm font-semibold text-foreground">Add a category</h2>
      <input type="hidden" name="restaurantId" value={restaurantId} />
      {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
      {state?.ok ? <FormSuccessBanner message={state.message ?? "Category created."} /> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
        <label htmlFor="new-category-name" className="sr-only">
          Category name
        </label>
        <Input
          id="new-category-name"
          name="name"
          required
          placeholder="e.g. Lunch"
          autoComplete="off"
          maxLength={80}
          invalid={Boolean(fieldErrors.name)}
        />
        <label htmlFor="new-category-description" className="sr-only">
          Description (optional)
        </label>
        <Input
          id="new-category-description"
          name="description"
          placeholder="Short description (optional)"
          maxLength={1000}
          invalid={Boolean(fieldErrors.description)}
        />
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "Adding…" : "Add category"}
        </Button>
      </div>
    </form>
  );
}

/** Inline rename form for one existing category row. */
export function CategoryEditForm({
  categoryId,
  name,
  description,
}: {
  categoryId: string;
  name: string;
  description: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    updateCategoryAction,
    undefined,
  );
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-1 flex-wrap items-center gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <label htmlFor={`cat-name-${categoryId}`} className="sr-only">
        Name
      </label>
      <Input
        id={`cat-name-${categoryId}`}
        name="name"
        defaultValue={name}
        required
        maxLength={80}
        className="max-w-44"
        invalid={Boolean(fieldErrors.name)}
      />
      <label htmlFor={`cat-desc-${categoryId}`} className="sr-only">
        Description
      </label>
      <Input
        id={`cat-desc-${categoryId}`}
        name="description"
        defaultValue={description ?? ""}
        maxLength={1000}
        className="min-w-0 flex-1"
        placeholder="Description (optional)"
        invalid={Boolean(fieldErrors.description)}
      />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="w-full text-[11px] text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="w-full text-[11px] text-accent">
          {state.message ?? "Saved."}
        </p>
      ) : null}
    </form>
  );
}
