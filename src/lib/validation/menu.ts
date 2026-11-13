import { z } from "zod";

export const categorySchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  name: z
    .string()
    .trim()
    .min(1, "Category name is required.")
    .max(80, "Category name must be 80 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1,000 characters or fewer.")
    .optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const updateCategorySchema = z.object({
  categoryId: z.uuid("Invalid category reference."),
  name: z
    .string()
    .trim()
    .min(1, "Category name is required.")
    .max(80, "Category name must be 80 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1,000 characters or fewer.")
    .optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryActiveSchema = z.object({
  categoryId: z.uuid("Invalid category reference."),
  isActive: z
    .enum(["true", "false"], { message: "Expected true or false." })
    .transform((v) => v === "true"),
});

export const archiveSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  id: z.uuid("Invalid reference."),
});

export const restoreSchema = archiveSchema;

/** Ordered reorder payload: the full sequence of live IDs for the restaurant. */
export const reorderCategoriesSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  ids: z.array(z.uuid()).min(1, "At least one category is required."),
});

export const reorderItemsSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  ids: z.array(z.uuid()).min(1, "At least one item is required."),
});

export const itemSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  categoryId: z.uuid("Choose a category."),
  name: z
    .string()
    .trim()
    .min(1, "Item name is required.")
    .max(120, "Item name must be 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be 2,000 characters or fewer.")
    .optional(),
  priceTzs: z.coerce
    .number()
    .int("Price must be a whole number of shillings.")
    .min(0, "Price cannot be negative.")
    .max(Number.MAX_SAFE_INTEGER, "Price is too large."),
  imageUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === "" || /^https:\/\//i.test(value), {
      message: "Image URL must start with https://.",
    })
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  isAvailable: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type ItemInput = z.infer<typeof itemSchema>;

export const updateItemSchema = itemSchema.omit({ restaurantId: true }).extend({
  itemId: z.uuid("Invalid item reference."),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const itemAvailabilitySchema = z.object({
  itemId: z.uuid("Invalid item reference."),
  isAvailable: z
    .enum(["true", "false"], { message: "Expected true or false." })
    .transform((v) => v === "true"),
});

export const itemImageUploadSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  fileName: z.string().trim().min(1, "Choose a file to upload.").max(255),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/avif"], {
    message: "Item image must be a PNG, JPEG, WebP or AVIF image.",
  }),
  sizeBytes: z.coerce
    .number()
    .int()
    .positive("Choose a file to upload.")
    .max(2 * 1024 * 1024, "Image must be 2 MB or smaller."),
});

export type ItemImageUploadInput = z.infer<typeof itemImageUploadSchema>;

export const itemImageConfirmSchema = z.object({
  restaurantId: z.uuid("Invalid restaurant reference."),
  itemId: z.uuid("Invalid item reference."),
  path: z
    .string()
    .trim()
    .min(3)
    .max(512)
    .regex(
      /^[0-9a-f-]{36}\/[0-9a-f-]{36}-[a-z0-9.-]+$/i,
      "Unexpected storage path for the item image.",
    ),
});

export type ItemImageConfirmInput = z.infer<typeof itemImageConfirmSchema>;
