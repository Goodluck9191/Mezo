/**
 * Profile completeness for the restaurant workspace.
 *
 * Pure module (no I/O, no Next.js imports) so it can be unit-tested and can run
 * on both server and client. The restaurant row only has platform-controlled
 * and admin-editable columns; this scores the admin-editable ones.
 */

export interface ProfileCompletenessInput {
  name?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
}

export interface ProfileField {
  key: keyof ProfileCompletenessInput;
  label: string;
  /** True when the field value counts as filled. */
  isFilled: (value: string | null | undefined) => boolean;
}

const filled = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

/** Ordered catalogue of the admin-editable profile fields we score. */
export const PROFILE_FIELDS: readonly ProfileField[] = [
  { key: "name", label: "Restaurant name", isFilled: filled },
  { key: "description", label: "Short description", isFilled: filled },
  { key: "logoUrl", label: "Logo", isFilled: filled },
  { key: "contactEmail", label: "Contact email", isFilled: filled },
  { key: "contactPhone", label: "Contact phone", isFilled: filled },
  { key: "addressLine1", label: "Street address", isFilled: filled },
  { key: "city", label: "City", isFilled: filled },
  { key: "region", label: "Region", isFilled: filled },
  { key: "countryCode", label: "Country", isFilled: filled },
] as const;

export interface ProfileCompleteness {
  total: number;
  completed: number;
  percent: number;
  missing: Array<{ key: string; label: string }>;
}

export function computeProfileCompletion(input: ProfileCompletenessInput): ProfileCompleteness {
  const missing: ProfileCompleteness["missing"] = [];
  let completed = 0;

  for (const field of PROFILE_FIELDS) {
    if (field.isFilled(input[field.key])) {
      completed += 1;
    } else {
      missing.push({ key: field.key, label: field.label });
    }
  }

  const total = PROFILE_FIELDS.length;
  return {
    total,
    completed,
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
    missing,
  };
}
