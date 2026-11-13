import { describe, expect, it } from "vitest";

import {
  categoryActiveSchema,
  categorySchema,
  itemImageConfirmSchema,
  itemImageUploadSchema,
  itemSchema,
  reorderCategoriesSchema,
  reorderItemsSchema,
  updateCategorySchema,
  updateItemSchema,
} from "@/lib/validation/menu";

const RESTAURANT_ID = crypto.randomUUID();
const CATEGORY_ID = crypto.randomUUID();
const ITEM_ID = crypto.randomUUID();

describe("categorySchema", () => {
  it("accepts a valid category", () => {
    const result = categorySchema.safeParse({ restaurantId: RESTAURANT_ID, name: "Lunch" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(categorySchema.safeParse({ restaurantId: RESTAURANT_ID, name: "" }).success).toBe(false);
    expect(categorySchema.safeParse({ restaurantId: RESTAURANT_ID, name: "   " }).success).toBe(
      false,
    );
  });

  it("rejects a name longer than 80 characters", () => {
    expect(
      categorySchema.safeParse({ restaurantId: RESTAURANT_ID, name: "x".repeat(81) }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid restaurant reference", () => {
    expect(categorySchema.safeParse({ restaurantId: "not-a-uuid", name: "Lunch" }).success).toBe(
      false,
    );
  });
});

describe("updateCategorySchema", () => {
  it("accepts a valid rename", () => {
    expect(
      updateCategorySchema.safeParse({ categoryId: CATEGORY_ID, name: "Dinner" }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid category reference", () => {
    expect(updateCategorySchema.safeParse({ categoryId: "x", name: "Dinner" }).success).toBe(false);
  });
});

describe("categoryActiveSchema", () => {
  it("coerces 'true'/'false' to boolean", () => {
    expect(categoryActiveSchema.parse({ categoryId: CATEGORY_ID, isActive: "true" }).isActive).toBe(
      true,
    );
    expect(
      categoryActiveSchema.parse({ categoryId: CATEGORY_ID, isActive: "false" }).isActive,
    ).toBe(false);
  });
});

describe("itemSchema", () => {
  const valid = {
    restaurantId: RESTAURANT_ID,
    categoryId: CATEGORY_ID,
    name: "Ugali",
    description: "House staple",
    priceTzs: "3500",
    imageUrl: "",
    isAvailable: "true",
  };

  it("accepts a valid item and coerces the price", () => {
    const result = itemSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceTzs).toBe(3500);
      expect(result.data.isAvailable).toBe(true);
      expect(result.data.imageUrl).toBeNull();
    }
  });

  it("rejects a negative price", () => {
    expect(itemSchema.safeParse({ ...valid, priceTzs: "-100" }).success).toBe(false);
  });

  it("rejects a non-integer price", () => {
    expect(itemSchema.safeParse({ ...valid, priceTzs: "1200.5" }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(itemSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects a name longer than 120 characters", () => {
    expect(itemSchema.safeParse({ ...valid, name: "x".repeat(121) }).success).toBe(false);
  });

  it("rejects a non-https image url", () => {
    expect(
      itemSchema.safeParse({ ...valid, imageUrl: "http://insecure.example.co/x.png" }).success,
    ).toBe(false);
  });

  it("rejects a category that is not a uuid", () => {
    expect(itemSchema.safeParse({ ...valid, categoryId: "123" }).success).toBe(false);
  });
});

describe("updateItemSchema", () => {
  it("accepts a valid item edit", () => {
    expect(
      updateItemSchema.safeParse({
        itemId: ITEM_ID,
        categoryId: CATEGORY_ID,
        name: "Ugali",
        description: "",
        priceTzs: "2500",
        imageUrl: "",
        isAvailable: "false",
      }).success,
    ).toBe(true);
  });
});

describe("itemImageUploadSchema", () => {
  const valid = {
    restaurantId: RESTAURANT_ID,
    fileName: "pilau.jpg",
    contentType: "image/jpeg",
    sizeBytes: "524288",
  };

  it("accepts a valid upload", () => {
    const result = itemImageUploadSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sizeBytes).toBe(524288);
    }
  });

  it.each(["image/png", "image/jpeg", "image/webp", "image/avif"])("accepts %s", (contentType) => {
    expect(itemImageUploadSchema.safeParse({ ...valid, contentType }).success).toBe(true);
  });

  it("rejects an SVG upload", () => {
    expect(
      itemImageUploadSchema.safeParse({ ...valid, contentType: "image/svg+xml" }).success,
    ).toBe(false);
  });

  it("rejects a file larger than 2 MB", () => {
    expect(
      itemImageUploadSchema.safeParse({ ...valid, sizeBytes: String(2 * 1024 * 1024 + 1) }).success,
    ).toBe(false);
  });
});

describe("itemImageConfirmSchema", () => {
  it("accepts a path of the expected shape", () => {
    const path = `${RESTAURANT_ID}/${crypto.randomUUID()}-pilau.jpg`;
    expect(
      itemImageConfirmSchema.safeParse({ restaurantId: RESTAURANT_ID, itemId: ITEM_ID, path })
        .success,
    ).toBe(true);
  });

  it("rejects a path outside the restaurant folder shape", () => {
    expect(
      itemImageConfirmSchema.safeParse({
        restaurantId: RESTAURANT_ID,
        itemId: ITEM_ID,
        path: "../other/x.png",
      }).success,
    ).toBe(false);
    expect(
      itemImageConfirmSchema.safeParse({
        restaurantId: RESTAURANT_ID,
        itemId: ITEM_ID,
        path: "shared/x.png",
      }).success,
    ).toBe(false);
  });
});

describe("reorder* schemas", () => {
  it("reorderCategoriesSchema requires a restaurant and at least one id", () => {
    expect(
      reorderCategoriesSchema.safeParse({ restaurantId: RESTAURANT_ID, ids: [crypto.randomUUID()] })
        .success,
    ).toBe(true);
    expect(
      reorderCategoriesSchema.safeParse({ restaurantId: RESTAURANT_ID, ids: [] }).success,
    ).toBe(false);
  });

  it("reorderItemsSchema requires a restaurant and at least one id", () => {
    expect(
      reorderItemsSchema.safeParse({ restaurantId: RESTAURANT_ID, ids: [crypto.randomUUID()] })
        .success,
    ).toBe(true);
    expect(
      reorderItemsSchema.safeParse({ restaurantId: "x", ids: [crypto.randomUUID()] }).success,
    ).toBe(false);
  });
});
