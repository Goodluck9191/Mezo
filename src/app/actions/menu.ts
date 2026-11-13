"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/validation/auth";

import { isRestaurantAdminOf, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env/server";
import {
  categoryActiveSchema,
  categorySchema,
  itemAvailabilitySchema,
  itemImageConfirmSchema,
  itemImageUploadSchema,
  itemSchema,
  reorderCategoriesSchema,
  reorderItemsSchema,
  updateCategorySchema,
  updateItemSchema,
} from "@/lib/validation/menu";

function firstParam(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function zodFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(error.flatten().fieldErrors)) {
    if (value && value.length > 0) {
      fieldErrors[key] = value;
    }
  }
  return fieldErrors;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NO_ADMIN = "Only a restaurant administrator can manage the menu.";

async function requireMenuAdmin(restaurantId: string) {
  const user = await requireUser(`/restaurant/menu?restaurant=${encodeURIComponent(restaurantId)}`);
  if (!(await isRestaurantAdminOf(user.id, restaurantId))) {
    return { ok: false as const, error: NO_ADMIN };
  }
  return { ok: true as const, user };
}

function revalidateMenu() {
  revalidatePath("/restaurant/menu", "page");
  revalidatePath("/restaurant/menu/categories", "page");
  revalidatePath("/restaurant/menu/items/new", "page");
  revalidatePath("/restaurant/dashboard", "page");
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createCategoryAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    name: firstParam(formData, "name"),
    description: firstParam(formData, "description") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const auth = await requireMenuAdmin(parsed.data.restaurantId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase.from("menu_categories").insert({
    restaurant_id: parsed.data.restaurantId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A category with that name already exists." };
    }

    return { ok: false, error: "Could not create the category. Please try again." };
  }

  revalidateMenu();
  return { ok: true, message: "Category created." };
}

export async function updateCategoryAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse({
    categoryId: firstParam(formData, "categoryId"),
    name: firstParam(formData, "name"),
    description: firstParam(formData, "description") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();

  const { data: category, error: categoryError } = await supabase
    .from("menu_categories")
    .select("id, restaurant_id")
    .eq("id", parsed.data.categoryId)
    .maybeSingle();

  if (categoryError || !category) {
    return { ok: false, error: "Category not found." };
  }

  const auth = await requireMenuAdmin(category.restaurant_id);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase
    .from("menu_categories")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq("id", parsed.data.categoryId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A category with that name already exists." };
    }

    return { ok: false, error: "Could not save the category. Please try again." };
  }

  revalidateMenu();
  return { ok: true, message: "Category saved." };
}

export async function setCategoryActiveAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = categoryActiveSchema.safeParse({
    categoryId: firstParam(formData, "categoryId"),
    isActive: firstParam(formData, "isActive"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Invalid category reference." };
  }

  const supabase = await createClient();
  const { data: category, error: categoryError } = await supabase
    .from("menu_categories")
    .select("id, restaurant_id")
    .eq("id", parsed.data.categoryId)
    .maybeSingle();

  if (categoryError || !category) {
    return { ok: false, error: "Category not found." };
  }

  const auth = await requireMenuAdmin(category.restaurant_id);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase
    .from("menu_categories")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.categoryId);

  if (error) {
    return { ok: false, error: "Could not update the category. Please try again." };
  }

  revalidateMenu();
  return {
    ok: true,
    message: parsed.data.isActive ? "Category activated." : "Category hidden from public menu.",
  };
}

export async function archiveCategoryAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  return setArchivedAction({
    idFrom: firstParam(formData, "categoryId"),
    archive: true,
    kind: "category",
  });
}

export async function restoreCategoryAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  return setArchivedAction({
    idFrom: firstParam(formData, "categoryId"),
    archive: false,
    kind: "category",
  });
}

async function setArchivedAction({
  idFrom,
  archive,
  kind,
}: {
  idFrom: string;
  archive: boolean;
  kind: "category" | "item";
}): Promise<ActionResult> {
  const supabase = await createClient();

  if (kind === "category") {
    const { data: category, error: categoryError } = await supabase
      .from("menu_categories")
      .select("id, restaurant_id")
      .eq("id", idFrom)
      .maybeSingle();

    if (categoryError || !category) {
      return { ok: false, error: "Category not found." };
    }

    const auth = await requireMenuAdmin(category.restaurant_id);
    if (!auth.ok) return { ok: false, error: auth.error };

    const { error } = await supabase
      .from("menu_categories")
      .update({ archived_at: archive ? new Date().toISOString() : null })
      .eq("id", idFrom);

    if (error) return { ok: false, error: GENERIC_ERROR };
  } else {
    const { data: item, error: itemError } = await supabase
      .from("menu_items")
      .select("id, restaurant_id")
      .eq("id", idFrom)
      .maybeSingle();

    if (itemError || !item) {
      return { ok: false, error: "Item not found." };
    }

    const auth = await requireMenuAdmin(item.restaurant_id);
    if (!auth.ok) return { ok: false, error: auth.error };

    const { error } = await supabase
      .from("menu_items")
      .update({ archived_at: archive ? new Date().toISOString() : null })
      .eq("id", idFrom);

    if (error) return { ok: false, error: GENERIC_ERROR };
  }

  revalidateMenu();
  return {
    ok: true,
    message:
      kind === "category"
        ? archive
          ? "Category archived."
          : "Category restored."
        : archive
          ? "Item archived."
          : "Item restored.",
  };
}

export async function reorderCategoriesAction(formData: FormData): Promise<ActionResult> {
  const ids = formData.getAll("orderedId");
  const parsed = reorderCategoriesSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    ids,
  });

  if (!parsed.success) {
    return { ok: false, error: "Invalid ordering payload." };
  }

  const auth = await requireMenuAdmin(parsed.data.restaurantId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = await createClient();

  // Verify all categories belong to this restaurant before reordering.
  const { data: owned, error: ownedError } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("restaurant_id", parsed.data.restaurantId)
    .in("id", parsed.data.ids);

  if (ownedError || !owned || owned.length !== parsed.data.ids.length) {
    return { ok: false, error: "Categories must belong to this restaurant." };
  }

  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await supabase
      .from("menu_categories")
      .update({ sort_order: index })
      .eq("id", id);

    if (error) {
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  revalidateMenu();
  return { ok: true, message: "Order saved." };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function createItemAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = itemSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    categoryId: firstParam(formData, "categoryId"),
    name: firstParam(formData, "name"),
    description: firstParam(formData, "description") || undefined,
    priceTzs: firstParam(formData, "priceTzs"),
    imageUrl: firstParam(formData, "imageUrl") || "",
    isAvailable: firstParam(formData, "isAvailable") || "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const auth = await requireMenuAdmin(parsed.data.restaurantId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("restaurant_id", parsed.data.restaurantId)
    .maybeSingle();

  if (!category) {
    return { ok: false, error: "Choose a category that belongs to this restaurant." };
  }

  const { error } = await supabase.from("menu_items").insert({
    restaurant_id: parsed.data.restaurantId,
    category_id: parsed.data.categoryId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    price_tzs: BigInt(parsed.data.priceTzs) as unknown as number,
    image_url: parsed.data.imageUrl ?? null,
    is_available: parsed.data.isAvailable ?? true,
  });

  if (error) {
    return { ok: false, error: "Could not create the item. Please try again." };
  }

  revalidateMenu();
  return { ok: true, message: "Item created." };
}

export async function updateItemAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateItemSchema.safeParse({
    itemId: firstParam(formData, "itemId"),
    categoryId: firstParam(formData, "categoryId"),
    name: firstParam(formData, "name"),
    description: firstParam(formData, "description") || undefined,
    priceTzs: firstParam(formData, "priceTzs"),
    imageUrl: firstParam(formData, "imageUrl") || "",
    isAvailable: firstParam(formData, "isAvailable") || "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("menu_items")
    .select("id, restaurant_id")
    .eq("id", parsed.data.itemId)
    .maybeSingle();

  if (itemError || !item) {
    return { ok: false, error: "Item not found." };
  }

  const auth = await requireMenuAdmin(item.restaurant_id);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: category } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("restaurant_id", item.restaurant_id)
    .maybeSingle();

  if (!category) {
    return { ok: false, error: "Choose a category that belongs to this restaurant." };
  }

  const { error } = await supabase
    .from("menu_items")
    .update({
      category_id: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price_tzs: BigInt(parsed.data.priceTzs) as unknown as number,
      image_url: parsed.data.imageUrl ?? null,
      is_available: parsed.data.isAvailable ?? true,
    })
    .eq("id", parsed.data.itemId);

  if (error) {
    return { ok: false, error: "Could not save the item. Please try again." };
  }

  revalidateMenu();
  return { ok: true, message: "Item saved." };
}

export async function setItemAvailabilityAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = itemAvailabilitySchema.safeParse({
    itemId: firstParam(formData, "itemId"),
    isAvailable: firstParam(formData, "isAvailable"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Invalid item reference." };
  }

  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("menu_items")
    .select("id, restaurant_id")
    .eq("id", parsed.data.itemId)
    .maybeSingle();

  if (itemError || !item) {
    return { ok: false, error: "Item not found." };
  }

  const auth = await requireMenuAdmin(item.restaurant_id);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: parsed.data.isAvailable })
    .eq("id", parsed.data.itemId);

  if (error) {
    return { ok: false, error: "Could not update the item. Please try again." };
  }

  revalidateMenu();
  return {
    ok: true,
    message: parsed.data.isAvailable ? "Item available." : "Item marked unavailable.",
  };
}

export async function archiveItemAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  return setArchivedAction({ idFrom: firstParam(formData, "itemId"), archive: true, kind: "item" });
}

export async function restoreItemAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  return setArchivedAction({
    idFrom: firstParam(formData, "itemId"),
    archive: false,
    kind: "item",
  });
}

export async function reorderItemsAction(formData: FormData): Promise<ActionResult> {
  const ids = formData.getAll("orderedId");
  const parsed = reorderItemsSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    ids,
  });

  if (!parsed.success) {
    return { ok: false, error: "Invalid ordering payload." };
  }

  const auth = await requireMenuAdmin(parsed.data.restaurantId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: owned, error: ownedError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("restaurant_id", parsed.data.restaurantId)
    .in("id", parsed.data.ids);

  if (ownedError || !owned || owned.length !== parsed.data.ids.length) {
    return { ok: false, error: "Items must belong to this restaurant." };
  }

  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await supabase.from("menu_items").update({ sort_order: index }).eq("id", id);
    if (error) return { ok: false, error: GENERIC_ERROR };
  }

  revalidateMenu();
  return { ok: true, message: "Order saved." };
}

// ---------------------------------------------------------------------------
// Item images (signed-upload-url flow, like the restaurant logo)
// ---------------------------------------------------------------------------

const ITEM_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type ItemImageUploadResult =
  { ok: true; path: string; token: string } | { ok: false; error: string };

export async function requestItemImageUploadAction(
  formData: FormData,
): Promise<ItemImageUploadResult> {
  const parsed = itemImageUploadSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    fileName: firstParam(formData, "fileName"),
    contentType: firstParam(formData, "contentType"),
    sizeBytes: firstParam(formData, "sizeBytes"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That file cannot be used as an item image.",
    };
  }

  const auth = await requireMenuAdmin(parsed.data.restaurantId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const extension = ITEM_IMAGE_EXTENSIONS[parsed.data.contentType];

  if (!extension) {
    return { ok: false, error: "Item image must be a PNG, JPEG, WebP or AVIF image." };
  }

  const safeName =
    parsed.data.fileName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || `item.${extension}`;

  const path = `${parsed.data.restaurantId}/${crypto.randomUUID()}-${safeName}`;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("menu-images").createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, error: "Could not start the upload. Please try again." };
  }

  return { ok: true, path: data.path, token: data.token };
}

export async function setItemImageAction(formData: FormData): Promise<ActionResult> {
  const parsed = itemImageConfirmSchema.safeParse({
    restaurantId: firstParam(formData, "restaurantId"),
    itemId: firstParam(formData, "itemId"),
    path: firstParam(formData, "path"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Unexpected image reference." };
  }

  const auth = await requireMenuAdmin(parsed.data.restaurantId);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!parsed.data.path.startsWith(`${parsed.data.restaurantId}/`)) {
    return { ok: false, error: "Unexpected image reference." };
  }

  const baseUrl = getServerEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const imageUrl = `${baseUrl}/storage/v1/object/public/menu-images/${parsed.data.path}`;

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ image_url: imageUrl })
    .eq("id", parsed.data.itemId)
    .eq("restaurant_id", parsed.data.restaurantId);

  if (error) {
    return { ok: false, error: "Could not save the item image. Please try again." };
  }

  revalidateMenu();
  return { ok: true, message: "Item image updated." };
}
