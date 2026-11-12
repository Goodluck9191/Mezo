import { describe, expect, it } from "vitest";

import {
  invitationActionSchema,
  invitationTokenSchema,
  inviteStaffSchema,
  logoUploadConfirmSchema,
  logoUploadRequestSchema,
  membershipActionSchema,
  updateRestaurantProfileSchema,
} from "@/lib/validation/restaurant";

const RESTAURANT_ID = crypto.randomUUID();
const MEMBER_ID = crypto.randomUUID();
const INVITATION_ID = crypto.randomUUID();

describe("updateRestaurantProfileSchema", () => {
  const valid = {
    restaurantId: RESTAURANT_ID,
    name: "Coastal Grill",
    description: "Seafood on the beach",
    logoUrl: "https://cdn.example.co/logo.png",
    contactEmail: "ops@coastal.co.tz",
    contactPhone: "+255712345678",
    addressLine1: "1 Ali Hassan Mwinyi Rd",
    addressLine2: "",
    city: "Dar es Salaam",
    region: "Dar es Salaam",
    countryCode: "TZ",
  };

  it("accepts a full, well-formed profile", () => {
    const result = updateRestaurantProfileSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts a minimal profile and normalizes country code", () => {
    const result = updateRestaurantProfileSchema.safeParse({
      restaurantId: RESTAURANT_ID,
      name: "Coastal Grill",
      countryCode: "tz",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countryCode).toBe("TZ");
    }
  });

  it("rejects an unknown country code format", () => {
    const result = updateRestaurantProfileSchema.safeParse({ ...valid, countryCode: "TZA" });
    expect(result.success).toBe(false);
  });

  it("rejects a bad phone number", () => {
    const result = updateRestaurantProfileSchema.safeParse({ ...valid, contactPhone: "call-me" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-https logo URL", () => {
    const result = updateRestaurantProfileSchema.safeParse({
      ...valid,
      logoUrl: "http://insecure.example.co/logo.png",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a restaurant id that is not a uuid", () => {
    const result = updateRestaurantProfileSchema.safeParse({
      ...valid,
      restaurantId: "restaurant-a",
    });
    expect(result.success).toBe(false);
  });

  it("never requires the slug, approval or subscription fields", () => {
    const result = updateRestaurantProfileSchema.safeParse({
      ...valid,
      slug: "new-slug",
      application_status: "approved",
      subscription_status: "active",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect("slug" in result.data).toBe(false);
      expect("application_status" in result.data).toBe(false);
      expect("subscription_status" in result.data).toBe(false);
    }
  });
});

describe("logoUploadRequestSchema", () => {
  const valid = {
    restaurantId: RESTAURANT_ID,
    fileName: "logo.png",
    contentType: "image/png",
    sizeBytes: "524288",
  };

  it("accepts a png under 2 MB and coerces the size", () => {
    const result = logoUploadRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sizeBytes).toBe(524288);
    }
  });

  it.each(["image/png", "image/jpeg", "image/webp", "image/avif"])("accepts %s", (contentType) => {
    expect(logoUploadRequestSchema.safeParse({ ...valid, contentType }).success).toBe(true);
  });

  it("rejects a disallowed MIME type (e.g. SVG, which can carry scripts)", () => {
    const result = logoUploadRequestSchema.safeParse({ ...valid, contentType: "image/svg+xml" });
    expect(result.success).toBe(false);
  });

  it("rejects a file larger than 2 MB", () => {
    const result = logoUploadRequestSchema.safeParse({
      ...valid,
      sizeBytes: String(2 * 1024 * 1024 + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero- and negative-size uploads", () => {
    expect(logoUploadRequestSchema.safeParse({ ...valid, sizeBytes: "0" }).success).toBe(false);
    expect(logoUploadRequestSchema.safeParse({ ...valid, sizeBytes: "-1" }).success).toBe(false);
  });
});

describe("logoUploadConfirmSchema", () => {
  const validPath = `${RESTAURANT_ID}/${crypto.randomUUID()}-logo.png`;

  it("accepts a path shaped like the one the server mints", () => {
    expect(
      logoUploadConfirmSchema.safeParse({ restaurantId: RESTAURANT_ID, path: validPath }).success,
    ).toBe(true);
  });

  it("rejects a path outside the restaurant's own folder shape", () => {
    expect(
      logoUploadConfirmSchema.safeParse({ restaurantId: RESTAURANT_ID, path: "../other/logo.png" })
        .success,
    ).toBe(false);
    expect(
      logoUploadConfirmSchema.safeParse({ restaurantId: RESTAURANT_ID, path: "shared/logo.png" })
        .success,
    ).toBe(false);
  });
});

describe("inviteStaffSchema", () => {
  const valid = {
    restaurantId: RESTAURANT_ID,
    email: "NEWHIRE@Example.TEST",
    role: "waiter",
  };

  it("accepts a waiter invitation and normalizes the email", () => {
    const result = inviteStaffSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("newhire@example.test");
    }
  });

  it.each(["waiter", "kitchen"])("accepts %s", (role) => {
    expect(inviteStaffSchema.safeParse({ ...valid, role }).success).toBe(true);
  });

  it("rejects restaurant_admin as an invited role — nobody self-grants admin", () => {
    const result = inviteStaffSchema.safeParse({ ...valid, role: "restaurant_admin" });
    expect(result.success).toBe(false);
  });

  it("rejects platform_admin as an invited role", () => {
    const result = inviteStaffSchema.safeParse({ ...valid, role: "platform_admin" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(inviteStaffSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
});

describe("invitationTokenSchema", () => {
  it("accepts a 64-hex token (two UUIDs concatenated)", () => {
    const token = "a".repeat(64);
    expect(invitationTokenSchema.safeParse(token).success).toBe(true);
  });

  it("rejects short or non-hex tokens", () => {
    expect(invitationTokenSchema.safeParse("abc123").success).toBe(false);
    expect(invitationTokenSchema.safeParse("g".repeat(64)).success).toBe(false);
  });
});

describe("membershipActionSchema", () => {
  it("accepts a uuid reference", () => {
    expect(
      membershipActionSchema.safeParse({ restaurantId: RESTAURANT_ID, memberId: MEMBER_ID })
        .success,
    ).toBe(true);
  });

  it("rejects non-uuid references", () => {
    expect(
      membershipActionSchema.safeParse({ restaurantId: "a", memberId: MEMBER_ID }).success,
    ).toBe(false);
    expect(
      membershipActionSchema.safeParse({ restaurantId: RESTAURANT_ID, memberId: "b" }).success,
    ).toBe(false);
  });
});

describe("invitationActionSchema", () => {
  it("validates the shape of a revoke call", () => {
    expect(
      invitationActionSchema.safeParse({ restaurantId: RESTAURANT_ID, invitationId: INVITATION_ID })
        .success,
    ).toBe(true);
  });

  it("rejects a non-uuid invitationId", () => {
    expect(
      invitationActionSchema.safeParse({ restaurantId: RESTAURANT_ID, invitationId: "nope" })
        .success,
    ).toBe(false);
  });
});
