import { describe, expect, it } from "vitest";

import {
  friendlyAuthError,
  signUpSchema,
  signInSchema,
  applyForRestaurantSchema,
  updateProfileSchema,
} from "@/lib/validation/auth";

describe("signUpSchema", () => {
  it("accepts a valid sign-up", () => {
    const result = signUpSchema.safeParse({
      fullName: "Asha Mrema",
      email: "Asha@Example.CO.TZ",
      password: "Secure123",
      confirmPassword: "Secure123",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("asha@example.co.tz");
  });

  it("rejects mismatched passwords", () => {
    const result = signUpSchema.safeParse({
      fullName: "Asha Mrema",
      email: "asha@example.test",
      password: "Secure123",
      confirmPassword: "Different123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a weak password", () => {
    const result = signUpSchema.safeParse({
      fullName: "Asha Mrema",
      email: "asha@example.test",
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("normalizes email casing", () => {
    const result = signInSchema.safeParse({ email: "Asha@Example.test", password: "ok" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("asha@example.test");
  });

  it("rejects empty email", () => {
    expect(signInSchema.safeParse({ email: "nope", password: "ok" }).success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts only supplied fields with blank avatar/phone as null-equivalents", () => {
    const result = updateProfileSchema.safeParse({
      fullName: "Asha Mrema",
      avatarUrl: "",
      phone: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-https avatar URLs", () => {
    expect(
      updateProfileSchema.safeParse({ fullName: "Asha", avatarUrl: "http://evil.test/x" }).success,
    ).toBe(false);
  });

  it("rejects phone numbers with letters", () => {
    expect(updateProfileSchema.safeParse({ fullName: "Asha", phone: "+255seven" }).success).toBe(
      false,
    );
  });
});

describe("applyForRestaurantSchema", () => {
  const record = {
    name: "Coastal Grill",
    slug: "coastal-grill",
    description: "Seafood and Swahili cooking",
    contactEmail: "ops@example.test",
    contactPhone: "+255700123456",
    city: "Dar es Salaam",
    region: "Dar es Salaam",
    message: "Bringing coastal cuisine to the city",
  };

  it("accepts a valid application", () => {
    expect(applyForRestaurantSchema.safeParse(record).success).toBe(true);
  });

  it("rejects invalid slug formats", () => {
    for (const slug of [
      "Coastal Grill",
      "-coastal",
      "a",
      "coastal grilling--more",
      "coastal–grill",
    ]) {
      expect(
        applyForRestaurantSchema.safeParse({ ...record, slug }).success,
        `slug ${JSON.stringify(slug)}`,
      ).toBe(false);
    }
  });

  it("normalizes casing to lowercase slug-safe text", () => {
    const result = applyForRestaurantSchema.safeParse({ ...record, slug: "Coastal-Grill" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe("coastal-grill");
  });
});

describe("friendlyAuthError", () => {
  it("maps invalid-credentials to a short message", () => {
    expect(friendlyAuthError({ message: "Invalid login credentials" })).toBe(
      "Email or password is incorrect.",
    );
  });

  it("maps email_not_confirmed", () => {
    expect(friendlyAuthError({ message: "Email not confirmed" })).toMatch(/confirm/i);
  });

  it("maps already-registered accounts", () => {
    expect(friendlyAuthError({ message: "User already registered" })).toMatch(/already exists/i);
  });

  it("maps rate-limit to a wait message", () => {
    expect(
      friendlyAuthError({
        message: "email rate limit exceeded",
        code: "over_email_send_rate_limit",
      }),
    ).toMatch(/too many/i);
  });

  it("falls back for unknown errors", () => {
    expect(friendlyAuthError({ message: "weird" }, "fallback")).toBe("fallback");
    expect(friendlyAuthError(null)).toMatch(/try again/i);
  });
});
