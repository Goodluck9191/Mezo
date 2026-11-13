"use client";

import { useActionState, useRef, useState } from "react";

import {
  createItemAction,
  requestItemImageUploadAction,
  setItemImageAction,
  updateItemAction,
  type ItemImageUploadResult,
} from "@/app/actions/menu";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/lib/validation/auth";
import { cn } from "@/utils/cn";

export interface ItemFormValues {
  itemId?: string;
  restaurantId: string;
  categories: Array<{ id: string; name: string }>;
  defaults?: {
    name: string;
    description: string | null;
    priceTzs: number;
    categoryId: string;
    imageUrl: string | null;
    isAvailable: boolean;
  };
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;

export function ItemForm({ restaurantId, categories, defaults, itemId }: ItemFormValues) {
  const isEdit = Boolean(itemId);
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    isEdit ? updateItemAction : createItemAction,
    undefined,
  );
  const [imageUrl, setImageUrl] = useState<string | null>(defaults?.imageUrl ?? null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageStatus, setImageStatus] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError(null);
    setImageStatus(null);

    if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
      setImageError("Image must be a PNG, JPEG, WebP or AVIF image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (!itemId) {
      setImageError("Save the item first, then add an image.");
      event.target.value = "";
      return;
    }

    setImageBusy(true);

    try {
      const request = new FormData();
      request.set("restaurantId", restaurantId);
      request.set("fileName", file.name);
      request.set("contentType", file.type);
      request.set("sizeBytes", String(file.size));

      const signed: ItemImageUploadResult = await requestItemImageUploadAction(request);

      if (!signed.ok) {
        setImageError(signed.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .uploadToSignedUrl(signed.path, signed.token, file);

      if (uploadError) {
        setImageError("The upload was rejected by storage. Please try another file.");
        return;
      }

      const confirm = new FormData();
      confirm.set("restaurantId", restaurantId);
      confirm.set("itemId", itemId);
      confirm.set("path", signed.path);

      const saved = await setItemImageAction(confirm);

      if (!saved.ok) {
        setImageError(saved.error);
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      setImageUrl(`${baseUrl}/storage/v1/object/public/menu-images/${signed.path}`);
      setImageStatus("Image updated.");
    } catch {
      setImageError("Something went wrong while uploading. Please try again.");
    } finally {
      setImageBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div
          aria-hidden="true"
          className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface"
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              No image
            </span>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-foreground">Item image</p>
          <p className="text-xs leading-5 text-muted">
            PNG, JPEG, WebP or AVIF, up to 2 MB.{" "}
            {isEdit
              ? "Replace takes effect immediately."
              : "Save the item first, then add an image."}
          </p>
          <label
            className={cn(
              "inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-strong px-4 text-xs font-medium text-foreground transition-colors hover:bg-surface",
              "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
              imageBusy && "pointer-events-none opacity-60",
            )}
          >
            {imageBusy ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="sr-only"
              onChange={handleImageChange}
              disabled={imageBusy}
            />
          </label>
          <p aria-live="polite" className="text-xs leading-5">
            {imageError ? (
              <span className="text-red-600 dark:text-red-400">{imageError}</span>
            ) : null}
            {imageStatus ? <span className="text-accent">{imageStatus}</span> : null}
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-5" aria-busy={pending}>
        {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
        {state?.ok ? <FormSuccessBanner message={state.message ?? "Item saved."} /> : null}

        <input type="hidden" name="restaurantId" value={restaurantId} />
        {itemId ? <input type="hidden" name="itemId" value={itemId} /> : null}
        <input type="hidden" name="imageUrl" value={imageUrl ?? ""} />

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField label="Item name" htmlFor="name" required error={fieldErrors.name?.[0]}>
            <Input
              id="name"
              name="name"
              required
              defaultValue={defaults?.name}
              invalid={Boolean(fieldErrors.name)}
              autoComplete="off"
              autoFocus
            />
          </AuthField>
          <AuthField
            label="Category"
            htmlFor="categoryId"
            required
            error={fieldErrors.categoryId?.[0]}
          >
            <Select
              id="categoryId"
              name="categoryId"
              required
              defaultValue={defaults?.categoryId}
              invalid={Boolean(fieldErrors.categoryId)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </AuthField>
        </div>

        <AuthField label="Description" htmlFor="description" error={fieldErrors.description?.[0]}>
          <Textarea
            id="description"
            name="description"
            defaultValue={defaults?.description ?? ""}
            maxLength={2000}
            invalid={Boolean(fieldErrors.description)}
            placeholder="Ingredients, preparation, allergens…"
          />
        </AuthField>

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            label="Price (TZS)"
            htmlFor="priceTzs"
            required
            error={fieldErrors.priceTzs?.[0]}
            hint="Whole shillings only"
          >
            <Input
              id="priceTzs"
              name="priceTzs"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              required
              defaultValue={defaults?.priceTzs}
              className="tabular-nums"
              invalid={Boolean(fieldErrors.priceTzs)}
            />
          </AuthField>
          <AuthField
            label="Available"
            htmlFor="isAvailable"
            hint="Unavailable items show a labelled badge in the public menu"
          >
            <Select
              id="isAvailable"
              name="isAvailable"
              defaultValue={String(defaults?.isAvailable ?? true)}
            >
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </Select>
          </AuthField>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save item" : "Add item"}
          </Button>
        </div>
      </form>
    </div>
  );
}
