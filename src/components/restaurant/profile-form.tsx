"use client";

import { useActionState, useRef, useState } from "react";

import {
  confirmLogoUploadAction,
  requestLogoUploadAction,
  updateRestaurantProfileAction,
} from "@/app/actions/restaurant";
import { AuthField, FormErrorBanner, FormSuccessBanner } from "@/components/auth/auth-form-parts";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/lib/validation/auth";
import { cn } from "@/utils/cn";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;

export interface ProfileFormRestaurant {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  countryCode: string;
}

export function ProfileForm({ restaurant }: { restaurant: ProfileFormRestaurant }) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    updateRestaurantProfileAction,
    undefined,
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(restaurant.logoUrl);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoMessage, setLogoMessage] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setLogoError(null);
    setLogoMessage(null);

    if (!ACCEPTED_LOGO_TYPES.includes(file.type as (typeof ACCEPTED_LOGO_TYPES)[number])) {
      setLogoError("Logo must be a PNG, JPEG, WebP or AVIF image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    setLogoBusy(true);

    try {
      const request = new FormData();
      request.set("restaurantId", restaurant.id);
      request.set("fileName", file.name);
      request.set("contentType", file.type);
      request.set("sizeBytes", String(file.size));

      const signed = await requestLogoUploadAction(null, request);

      if (!signed.ok) {
        setLogoError(signed.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("restaurant-logos")
        .uploadToSignedUrl(signed.path, signed.token, file);

      if (uploadError) {
        setLogoError("The upload was rejected by storage. Please try another file.");
        return;
      }

      const confirm = new FormData();
      confirm.set("restaurantId", restaurant.id);
      confirm.set("path", signed.path);

      const saved = await confirmLogoUploadAction(null, confirm);

      if (!saved.ok) {
        setLogoError(saved.error);
        return;
      }

      if (saved.logoUrl) {
        setLogoUrl(saved.logoUrl);
      }

      setLogoMessage("Logo updated.");
    } catch {
      setLogoError("Something went wrong while uploading the logo. Please try again.");
    } finally {
      setLogoBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Logo — uploaded directly to Supabase Storage via a short-lived signed URL */}
      <div className="flex flex-wrap items-start gap-5">
        <div
          aria-hidden="true"
          className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface"
        >
          {logoUrl ? (
            // Arbitrary external URLs are allowed as restaurant logos; a plain
            // <img> avoids having to enumerate remote hosts for next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-lg font-semibold text-muted">
              {restaurant.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-foreground">Logo</p>
          <p className="text-xs leading-5 text-muted">
            PNG, JPEG, WebP or AVIF, up to 2 MB. Uploads go straight to storage; replacing the logo
            takes effect immediately.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={cn(
                "inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-strong px-4 text-xs font-medium text-foreground transition-colors hover:bg-surface",
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
                logoBusy && "pointer-events-none opacity-60",
              )}
            >
              {logoBusy ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_LOGO_TYPES.join(",")}
                className="sr-only"
                onChange={handleLogoChange}
                disabled={logoBusy}
              />
            </label>
          </div>
          <p aria-live="polite" className="text-xs leading-5">
            {logoError ? <span className="text-red-600 dark:text-red-400">{logoError}</span> : null}
            {logoMessage ? <span className="text-accent">{logoMessage}</span> : null}
          </p>
        </div>
      </div>

      {/* Profile fields */}
      <form action={formAction} className="space-y-5" aria-busy={pending}>
        {state && !state.ok ? <FormErrorBanner message={state.error} /> : null}
        {state?.ok ? <FormSuccessBanner message={state.message ?? "Profile saved."} /> : null}

        <input type="hidden" name="restaurantId" value={restaurant.id} />
        <input type="hidden" name="logoUrl" value={logoUrl ?? ""} />

        <AuthField label="Restaurant name" htmlFor="name" required error={fieldErrors.name?.[0]}>
          <Input
            id="name"
            name="name"
            required
            defaultValue={restaurant.name}
            invalid={Boolean(fieldErrors.name)}
            autoComplete="organization"
          />
        </AuthField>

        <AuthField label="Description" htmlFor="description" error={fieldErrors.description?.[0]}>
          <Textarea
            id="description"
            name="description"
            defaultValue={restaurant.description ?? ""}
            maxLength={2000}
            invalid={Boolean(fieldErrors.description)}
            placeholder="What your restaurant is known for — cuisine, vibe, signature dishes."
          />
        </AuthField>

        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField
            label="Contact email"
            htmlFor="contactEmail"
            error={fieldErrors.contactEmail?.[0]}
            hint="Visible to customers"
          >
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={restaurant.contactEmail ?? ""}
              invalid={Boolean(fieldErrors.contactEmail)}
              autoComplete="email"
              placeholder="ops@yourrestaurant.co.tz"
            />
          </AuthField>

          <AuthField
            label="Contact phone"
            htmlFor="contactPhone"
            error={fieldErrors.contactPhone?.[0]}
            hint="e.g. +255712345678"
          >
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              defaultValue={restaurant.contactPhone ?? ""}
              invalid={Boolean(fieldErrors.contactPhone)}
              autoComplete="tel"
            />
          </AuthField>
        </div>

        <AuthField
          label="Street address"
          htmlFor="addressLine1"
          error={fieldErrors.addressLine1?.[0]}
        >
          <Input
            id="addressLine1"
            name="addressLine1"
            defaultValue={restaurant.addressLine1 ?? ""}
            invalid={Boolean(fieldErrors.addressLine1)}
            autoComplete="address-line1"
            placeholder="123 Ali Hassan Mwinyi Road"
          />
        </AuthField>

        <AuthField
          label="Address line 2"
          htmlFor="addressLine2"
          error={fieldErrors.addressLine2?.[0]}
        >
          <Input
            id="addressLine2"
            name="addressLine2"
            defaultValue={restaurant.addressLine2 ?? ""}
            invalid={Boolean(fieldErrors.addressLine2)}
            autoComplete="address-line2"
            placeholder="Shop 4, Ground floor (optional)"
          />
        </AuthField>

        <div className="grid gap-5 sm:grid-cols-3">
          <AuthField label="City" htmlFor="city" error={fieldErrors.city?.[0]}>
            <Input
              id="city"
              name="city"
              defaultValue={restaurant.city ?? ""}
              invalid={Boolean(fieldErrors.city)}
              autoComplete="address-level2"
              placeholder="Dar es Salaam"
            />
          </AuthField>

          <AuthField label="Region" htmlFor="region" error={fieldErrors.region?.[0]}>
            <Input
              id="region"
              name="region"
              defaultValue={restaurant.region ?? ""}
              invalid={Boolean(fieldErrors.region)}
              autoComplete="address-level1"
              placeholder="Dar es Salaam"
            />
          </AuthField>

          <AuthField
            label="Country"
            htmlFor="countryCode"
            required
            error={fieldErrors.countryCode?.[0]}
          >
            <Input
              id="countryCode"
              name="countryCode"
              defaultValue={restaurant.countryCode}
              required
              maxLength={2}
              invalid={Boolean(fieldErrors.countryCode)}
              autoComplete="country"
              placeholder="TZ"
            />
          </AuthField>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
          <p className="text-xs text-muted">
            Approval, subscription and role stay controlled by the platform.
          </p>
        </div>
      </form>
    </div>
  );
}
