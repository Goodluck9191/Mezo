import "server-only";

import type { Database } from "@/types/database";

import { isRestaurantAdminOf } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export type MenuCategoryRow = Database["public"]["Tables"]["menu_categories"]["Row"];
export type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"];

export interface CategorySummary {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  archivedAt: string | null;
  itemCount: number;
}

export interface ItemSummary {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  priceTzs: number;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
}

function toNumber(value: number | bigint | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function itemCountsByCategory(
  restaurantId: string,
  categoryIds: string[],
  includeArchived: boolean,
): Promise<Map<string, number>> {
  if (categoryIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  let query = supabase
    .from("menu_items")
    .select("category_id")
    .eq("restaurant_id", restaurantId)
    .in("category_id", categoryIds);

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error || !data) {
    return new Map();
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

/** Live (or, optionally including archived) categories for the workspace. */
export async function listCategoriesForRestaurant(
  restaurantId: string,
  options: { includeArchived?: boolean } = {},
): Promise<CategorySummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("menu_categories")
    .select("id, name, description, sort_order, is_active, archived_at")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!options.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  const counts = await itemCountsByCategory(
    restaurantId,
    data.map((category) => category.id),
    Boolean(options.includeArchived),
  );

  return data.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    sortOrder: category.sort_order,
    isActive: category.is_active,
    archivedAt: category.archived_at,
    itemCount: counts.get(category.id) ?? 0,
  }));
}

export interface ItemFilter {
  query?: string;
  categoryId?: string;
  availability?: "available" | "unavailable";
  includeArchived?: boolean;
  limit?: number;
}

/** Menu items, decorated with their category name, for the workspace. */
export async function listItemsForRestaurant(
  restaurantId: string,
  filter: ItemFilter = {},
): Promise<ItemSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("menu_items")
    .select(
      "id, category_id, name, description, price_tzs, image_url, is_available, sort_order, archived_at, created_at, menu_categories!inner(name)",
    )
    .eq("restaurant_id", restaurantId)
    .order("category_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (filter.categoryId) {
    query = query.eq("category_id", filter.categoryId);
  }

  if (filter.availability === "available") {
    query = query.eq("is_available", true);
  } else if (filter.availability === "unavailable") {
    query = query.eq("is_available", false);
  }

  if (!filter.includeArchived) {
    query = query.is("archived_at", null);
  }

  if (filter.query && filter.query.trim()) {
    // PostgREST .or() splits on commas — strip commas, parens and underscores
    // from the needle ("_" is a LIKE wildcard).
    const cleaned = filter.query
      .trim()
      .replace(/[()_,]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const needle = `%${cleaned}%`;
    query = query.or(`name.ilike.${needle},description.ilike.${needle}`);
  }

  if (filter.limit) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return (data as unknown as Array<MenuItemRow & { menu_categories: { name: string } | null }>).map(
    (row) => ({
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.menu_categories?.name ?? "—",
      name: row.name,
      description: row.description,
      priceTzs: toNumber(row.price_tzs),
      imageUrl: row.image_url,
      isAvailable: row.is_available,
      sortOrder: row.sort_order,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
    }),
  );
}

/** Menu counts for the dashboard/menu overview. */
export async function menuCountsForRestaurant(restaurantId: string): Promise<{
  categories: number;
  items: number;
  available: number;
  unavailable: number;
  archived: number;
}> {
  const supabase = await createClient();

  const [categoriesRes, itemsRes, archivedRes] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .is("archived_at", null),
    supabase
      .from("menu_items")
      .select("id, is_available")
      .eq("restaurant_id", restaurantId)
      .is("archived_at", null),
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .not("archived_at", "is", null),
  ]);

  const items = itemsRes.data ?? [];
  const available = items.filter((item) => item.is_available).length;

  return {
    categories: categoriesRes.count ?? 0,
    items: items.length,
    available,
    unavailable: items.length - available,
    archived: archivedRes.count ?? 0,
  };
}

/** Load a single item for the edit form, or null. */
export async function getItemForEdit(
  restaurantId: string,
  itemId: string,
): Promise<ItemSummary | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id, category_id, name, description, price_tzs, image_url, is_available, sort_order, archived_at, created_at, menu_categories!inner(name)",
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as MenuItemRow & { menu_categories: { name: string } | null };
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.menu_categories?.name ?? "—",
    name: row.name,
    description: row.description,
    priceTzs: toNumber(row.price_tzs),
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

/** Convenience wrapper used by menu actions to assert admin-of-this-restaurant. */
export async function requireMenuAdmin(userId: string, restaurantId: string): Promise<boolean> {
  return isRestaurantAdminOf(userId, restaurantId);
}
