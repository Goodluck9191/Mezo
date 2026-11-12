import { describe, expect, it } from "vitest";

import {
  assignPlanSchema,
  createSubscriptionPlanSchema,
  recordPaymentSchema,
  setPlanActiveSchema,
  setSubscriptionStatusSchema,
  updateSubscriptionPlanSchema,
} from "@/lib/validation/subscription";

const PLAN_ID = crypto.randomUUID();
const RESTAURANT_ID = crypto.randomUUID();

describe("createSubscriptionPlanSchema", () => {
  const valid = {
    code: "business_monthly",
    name: "Business",
    description: "placeholder tier",
    priceTzs: "45000",
    billingInterval: "monthly" as const,
    tableLimit: "20",
    isActive: "true",
  };

  it("accepts a well-formed catalogue entry", () => {
    const result = createSubscriptionPlanSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceTzs).toBe(45000);
      expect(result.data.tableLimit).toBe(20);
      expect(result.data.isActive).toBe(true);
    }
  });

  it("normalizes the code to lowercase", () => {
    const result = createSubscriptionPlanSchema.safeParse({ ...valid, code: "BUSINESS_MONTHLY" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe("business_monthly");
  });

  it("rejects invalid codes", () => {
    for (const code of ["A", "with spaces", "with-dots!", "x".repeat(41)]) {
      expect(createSubscriptionPlanSchema.safeParse({ ...valid, code }).success).toBe(false);
    }
  });

  it("rejects negative prices", () => {
    expect(createSubscriptionPlanSchema.safeParse({ ...valid, priceTzs: "-1" }).success).toBe(
      false,
    );
  });

  it("accepts 0 as a placeholder / custom price", () => {
    expect(createSubscriptionPlanSchema.safeParse({ ...valid, priceTzs: "0" }).success).toBe(true);
  });

  it("rejects out-of-range table limits", () => {
    expect(createSubscriptionPlanSchema.safeParse({ ...valid, tableLimit: "0" }).success).toBe(
      false,
    );
    expect(createSubscriptionPlanSchema.safeParse({ ...valid, tableLimit: "10001" }).success).toBe(
      false,
    );
  });

  it("rejects invalid billing intervals", () => {
    expect(
      createSubscriptionPlanSchema.safeParse({ ...valid, billingInterval: "weekly" }).success,
    ).toBe(false);
  });
});

describe("updateSubscriptionPlanSchema", () => {
  it("accepts an update without a code (code is immutable)", () => {
    const result = updateSubscriptionPlanSchema.safeParse({
      planId: PLAN_ID,
      name: "Growth",
      description: "updated",
      priceTzs: "85000",
      billingInterval: "monthly",
      tableLimit: "20",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid plan reference", () => {
    expect(
      updateSubscriptionPlanSchema.safeParse({
        planId: "plan-1",
        name: "Growth",
        priceTzs: "85000",
        billingInterval: "monthly",
        tableLimit: "20",
      }).success,
    ).toBe(false);
  });
});

describe("setPlanActiveSchema", () => {
  it("coerces 'true'/'false' to booleans", () => {
    expect(setPlanActiveSchema.parse({ planId: PLAN_ID, isActive: "true" }).isActive).toBe(true);
    expect(setPlanActiveSchema.parse({ planId: PLAN_ID, isActive: "false" }).isActive).toBe(false);
  });
});

describe("assignPlanSchema", () => {
  it("accepts optional dates", () => {
    expect(
      assignPlanSchema.safeParse({ restaurantId: RESTAURANT_ID, planId: PLAN_ID }).success,
    ).toBe(true);
    expect(
      assignPlanSchema.safeParse({
        restaurantId: RESTAURANT_ID,
        planId: PLAN_ID,
        startsOn: "",
        renewsOn: "2026-12-11",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(
      assignPlanSchema.safeParse({
        restaurantId: RESTAURANT_ID,
        planId: PLAN_ID,
        startsOn: "11/12/2026",
      }).success,
    ).toBe(false);
  });

  it("rejects non-uuid references", () => {
    expect(assignPlanSchema.safeParse({ restaurantId: "a", planId: PLAN_ID }).success).toBe(false);
  });
});

describe("setSubscriptionStatusSchema", () => {
  it.each(["active", "past_due", "expired", "cancelled"])("accepts %s", (status) => {
    expect(
      setSubscriptionStatusSchema.safeParse({ restaurantId: RESTAURANT_ID, status }).success,
    ).toBe(true);
  });

  it("rejects pending and arbitrary statuses", () => {
    expect(
      setSubscriptionStatusSchema.safeParse({ restaurantId: RESTAURANT_ID, status: "pending" })
        .success,
    ).toBe(false);
    expect(
      setSubscriptionStatusSchema.safeParse({ restaurantId: RESTAURANT_ID, status: "suspended" })
        .success,
    ).toBe(false);
  });
});

describe("recordPaymentSchema", () => {
  const valid = {
    restaurantId: RESTAURANT_ID,
    amountTzs: "85000",
    status: "successful" as const,
    providerReference: "sn-2026-000123",
    periodStartsOn: "2026-11-01",
    periodEndsOn: "2026-11-30",
    failureReason: "",
  };

  it("accepts a well-formed record", () => {
    const result = recordPaymentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountTzs).toBe(85000);
    }
  });

  it("accepts a failed provider record with a reason", () => {
    const result = recordPaymentSchema.safeParse({
      ...valid,
      status: "failed",
      failureReason: "network timeout",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative amounts", () => {
    expect(recordPaymentSchema.safeParse({ ...valid, amountTzs: "-1" }).success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    expect(
      recordPaymentSchema.safeParse({
        ...valid,
        periodStartsOn: "2026-12-01",
        periodEndsOn: "2026-11-30",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid provider reference format", () => {
    expect(recordPaymentSchema.safeParse({ ...valid, providerReference: "x" }).success).toBe(false);
    expect(
      recordPaymentSchema.safeParse({ ...valid, providerReference: "has spaces in it" }).success,
    ).toBe(false);
  });

  it("accepts an empty reference (operator-collected without reference)", () => {
    expect(recordPaymentSchema.safeParse({ ...valid, providerReference: "" }).success).toBe(true);
  });
});
