import { describe, expect, it } from "vitest";

import {
  computeProfileCompletion,
  PROFILE_FIELDS,
  type ProfileCompletenessInput,
} from "@/lib/profile-completion";

const completeInput: ProfileCompletenessInput = {
  name: "Coastal Grill",
  description: "Seafood joint on the beach",
  logoUrl: "https://example.supabase.co/storage/v1/object/public/restaurant-logos/id/logo.png",
  contactEmail: "ops@coastalgrill.co.tz",
  contactPhone: "+255712345678",
  addressLine1: "1 Ali Hassan Mwinyi Rd",
  city: "Dar es Salaam",
  region: "Dar es Salaam",
  countryCode: "TZ",
};

describe("computeProfileCompletion", () => {
  it("reports 0% for an empty profile and lists every field as missing", () => {
    const result = computeProfileCompletion({});

    expect(result.completed).toBe(0);
    expect(result.total).toBe(PROFILE_FIELDS.length);
    expect(result.percent).toBe(0);
    expect(result.missing).toHaveLength(PROFILE_FIELDS.length);
  });

  it("reports 100% only when every field is filled", () => {
    const result = computeProfileCompletion(completeInput);

    expect(result.completed).toBe(result.total);
    expect(result.percent).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it("counts only non-blank values as filled", () => {
    const result = computeProfileCompletion({
      ...completeInput,
      description: "   ",
      logoUrl: null,
    });

    expect(result.missing.map((item) => item.key).sort()).toEqual(["description", "logoUrl"]);
    expect(result.completed).toBe(result.total - 2);
  });

  it("always keeps name required", () => {
    const withoutName = computeProfileCompletion({ ...completeInput, name: "" });
    expect(withoutName.missing.some((item) => item.key === "name")).toBe(true);
    expect(withoutName.percent).toBeLessThan(100);
  });

  it("rounds the percentage to a whole number", () => {
    // 8 of 9 fields filled → 88.88…%, rendered as 89.
    const result = computeProfileCompletion({ ...completeInput, countryCode: "" });
    expect(result.percent).toBe(Math.round(((result.total - 1) / result.total) * 100));
  });

  it("labels each missing item with the human-readable field name", () => {
    const result = computeProfileCompletion({});
    const missingLabels = result.missing.map((item) => item.label);

    expect(missingLabels).toContain("Restaurant name");
    expect(missingLabels).toContain("Logo");
    expect(missingLabels).toContain("Contact phone");
  });
});
