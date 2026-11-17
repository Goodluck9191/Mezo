"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/validation/auth";

import { isRestaurantAdminOf, membershipsWithRole, requireUser } from "@/lib/auth/guards";
import { getPublicEnv } from "@/lib/env/client";
import { buildTableQrUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import {
  createTableSchema,
  tableIdSchema,
  tableRequestIdSchema,
  tableSessionIdSchema,
} from "@/lib/validation/tables";
import { qrSvgDataUrl } from "@/lib/qr-code";

const GENERIC_ERROR = "Something went wrong. Please try again.";

async function staffRoleFor(
  userId: string,
  restaurantId: string,
): Promise<"restaurant_admin" | "waiter" | null> {
  const memberships = await membershipsWithRole(userId, ["waiter", "restaurant_admin"]);
  const membership = memberships.find((m) => m.restaurantId === restaurantId);
  return membership?.role === "restaurant_admin" || membership?.role === "waiter"
    ? membership.role
    : null;
}

/** Map an RPC error into something safe for the UI. */
function mapAccessError(message: string | undefined, fallback: string): string {
  const text = message ?? "";
  if (/expired/i.test(text)) return "That request has expired.";
  if (/not pending/i.test(text)) return "That request is no longer pending.";
  if (/not found/i.test(text)) return "That request was not found.";
  if (/closed/i.test(text)) return "The table session was already closed.";
  if (/not active/i.test(text)) return "This restaurant is not accepting orders right now.";
  if (/staff|administrator|42501/i.test(text)) return "You are not authorized to do that.";
  return fallback;
}

async function loadRequestForStaff(
  userId: string,
  requestId: string,
): Promise<{ ok: true; restaurantId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_access_requests")
    .select("id, restaurant_id")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Request not found." };
  }

  const role = await staffRoleFor(userId, data.restaurant_id);
  if (!role) {
    return { ok: false, error: "Only wait staff of this restaurant can decide table access." };
  }

  return { ok: true, restaurantId: data.restaurant_id };
}

export async function approveTableAccessAction(requestId: string): Promise<ActionResult> {
  const parsed = tableRequestIdSchema.safeParse({ requestId });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const user = await requireUser("/waiter/tables");
  const loaded = await loadRequestForStaff(user.id, parsed.data.requestId);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_table_access", {
    p_request_id: parsed.data.requestId,
  });

  if (error) {
    return { ok: false, error: mapAccessError(error.message, "Could not approve the request.") };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { status?: string } | null;
  if (row?.status !== "approved") {
    return { ok: false, error: "That request has expired. Ask the guest to scan again." };
  }

  revalidatePath("/waiter/tables", "page");
  return { ok: true, message: "Guest approved and seated." };
}

export async function rejectTableAccessAction(requestId: string): Promise<ActionResult> {
  const parsed = tableRequestIdSchema.safeParse({ requestId });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const user = await requireUser("/waiter/tables");
  const loaded = await loadRequestForStaff(user.id, parsed.data.requestId);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reject_table_access", {
    p_request_id: parsed.data.requestId,
  });

  if (error) {
    return { ok: false, error: mapAccessError(error.message, "Could not reject the request.") };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { status?: string } | null;
  if (row?.status !== "rejected") {
    return { ok: false, error: "That request has expired." };
  }

  revalidatePath("/waiter/tables", "page");
  return { ok: true, message: "Request rejected." };
}

export async function closeTableSessionAction(sessionId: string): Promise<ActionResult> {
  const parsed = tableSessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) return { ok: false, error: "Invalid session." };

  const user = await requireUser("/waiter/tables");
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("table_sessions")
    .select("id, restaurant_id")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { ok: false, error: "Session not found." };
  }

  const role = await staffRoleFor(user.id, session.restaurant_id);
  if (!role) {
    return { ok: false, error: "Only wait staff of this restaurant can close a session." };
  }

  const { error } = await supabase.rpc("close_table_session", {
    p_session_id: parsed.data.sessionId,
  });

  if (error) {
    return { ok: false, error: mapAccessError(error.message, "Could not close the session.") };
  }

  revalidatePath("/waiter/tables", "page");
  return { ok: true, message: "Table session closed." };
}

export interface CreatedTableQr {
  tableId: string;
  tableName: string;
  url: string;
  /** SVG data URL of the QR code — render or download directly. */
  image: string;
}

export type CreateTableResult =
  | { ok: true; message: string; qr: CreatedTableQr }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createTableAction(
  _prevState: CreateTableResult | undefined,
  formData: FormData,
): Promise<CreateTableResult> {
  const parsed = createTableSchema.safeParse({
    restaurantId:
      typeof formData.get("restaurantId") === "string" ? formData.get("restaurantId") : "",
    name: typeof formData.get("name") === "string" ? formData.get("name") : "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed.error.flatten().fieldErrors)) {
      if (value && value.length > 0) fieldErrors[key] = value;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const user = await requireUser(
    `/restaurant/tables?restaurant=${encodeURIComponent(parsed.data.restaurantId)}`,
  );
  if (!(await isRestaurantAdminOf(user.id, parsed.data.restaurantId))) {
    return { ok: false, error: "Only a restaurant administrator can add tables." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_table_with_qr", {
    p_restaurant_id: parsed.data.restaurantId,
    p_name: parsed.data.name,
  });

  if (error) {
    if (error.code === "23514" || /table limit/i.test(error.message)) {
      return { ok: false, error: "Table limit for your plan reached. Upgrade to add more tables." };
    }
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return {
        ok: false,
        error: "A table with that name already exists.",
        fieldErrors: { name: ["Name is taken."] },
      };
    }
    return { ok: false, error: "Could not create the table. Please try again." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    { id: string; name: string; token: string } | undefined;

  if (!row) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const url = buildTableQrUrl({ appUrl: NEXT_PUBLIC_APP_URL }, row.token);
  const image = await qrSvgDataUrl(url);

  revalidatePath("/restaurant/tables", "page");
  return {
    ok: true,
    message: "Table created.",
    qr: {
      tableId: row.id,
      tableName: row.name,
      url,
      image,
    },
  };
}

export type RegenerateQrResult = { ok: true; qr: CreatedTableQr } | { ok: false; error: string };

export async function regenerateQrAction(tableId: string): Promise<RegenerateQrResult> {
  const parsed = tableIdSchema.safeParse({ tableId });
  if (!parsed.success) return { ok: false, error: "Invalid table." };

  const user = await requireUser("/restaurant/tables");
  const supabase = await createClient();

  const { data: table, error: tableError } = await supabase
    .from("restaurant_tables")
    .select("id, name, restaurant_id")
    .eq("id", parsed.data.tableId)
    .maybeSingle();

  if (tableError || !table) {
    return { ok: false, error: "Table not found." };
  }

  if (!(await isRestaurantAdminOf(user.id, table.restaurant_id))) {
    return { ok: false, error: "Only a restaurant administrator can regenerate a table QR code." };
  }

  const { data, error } = await supabase.rpc("regenerate_table_qr_token", {
    p_table_id: parsed.data.tableId,
  });

  if (error) {
    return { ok: false, error: mapAccessError(error.message, "Could not regenerate the QR code.") };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    { id: string; name: string; token: string } | undefined;

  if (!row) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const url = buildTableQrUrl({ appUrl: NEXT_PUBLIC_APP_URL }, row.token);
  const image = await qrSvgDataUrl(url);

  revalidatePath("/restaurant/tables", "page");
  return {
    ok: true,
    qr: {
      tableId: row.id,
      tableName: row.name,
      url,
      image,
    },
  };
}

export async function setTableActiveAction(
  tableId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const parsed = tableIdSchema.safeParse({ tableId });
  if (!parsed.success || typeof isActive !== "boolean") {
    return { ok: false, error: "Invalid input." };
  }

  const user = await requireUser("/restaurant/tables");
  const supabase = await createClient();

  const { data: table, error: tableError } = await supabase
    .from("restaurant_tables")
    .select("id, restaurant_id")
    .eq("id", parsed.data.tableId)
    .maybeSingle();

  if (tableError || !table) {
    return { ok: false, error: "Table not found." };
  }

  if (!(await isRestaurantAdminOf(user.id, table.restaurant_id))) {
    return { ok: false, error: "Only a restaurant administrator can change tables." };
  }

  const { error } = await supabase
    .from("restaurant_tables")
    .update({ is_active: isActive })
    .eq("id", parsed.data.tableId);

  if (error) {
    return { ok: false, error: "Could not update the table." };
  }

  revalidatePath("/restaurant/tables", "page");
  return { ok: true, message: isActive ? "Table is active again." : "Table deactivated." };
}
