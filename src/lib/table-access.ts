import "server-only";

import { membershipsWithRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export interface TablePendingRequest {
  id: string;
  restaurantId: string;
  restaurantName: string;
  tableId: string;
  tableName: string;
  partySize: number | null;
  requestedAt: string;
  expiresAt: string;
}

export interface TableActiveSession {
  id: string;
  restaurantId: string;
  restaurantName: string;
  tableId: string;
  tableName: string;
  approvedAt: string | null;
  guestCount: number;
}

export interface TableAccessBoard {
  requests: TablePendingRequest[];
  sessions: TableActiveSession[];
  restaurants: Array<{ restaurantId: string; name: string }>;
}

/** Pending access requests and active sessions across the caller's staff restaurants. */
export async function getTableAccessBoard(userId: string): Promise<TableAccessBoard> {
  const memberships = await membershipsWithRole(userId, ["waiter", "restaurant_admin"]);
  if (memberships.length === 0) {
    return { requests: [], sessions: [], restaurants: [] };
  }

  const restaurantIds = memberships.map((m) => m.restaurantId);
  const nameById = new Map(memberships.map((m) => [m.restaurantId, m.restaurant.name]));
  const supabase = await createClient();

  const [requestsRes, sessionsRes] = await Promise.all([
    supabase
      .from("table_access_requests")
      .select("id, restaurant_id, table_id, party_size, requested_at, expires_at")
      .in("restaurant_id", restaurantIds)
      .eq("status", "pending")
      .order("requested_at", { ascending: true }),
    supabase
      .from("table_sessions")
      .select("id, restaurant_id, table_id, approved_at, status")
      .in("restaurant_id", restaurantIds)
      .eq("status", "active")
      .order("approved_at", { ascending: true }),
  ]);

  const rawRequests = requestsRes.data ?? [];
  const rawSessions = sessionsRes.data ?? [];

  const tableIds = [
    ...new Set([...rawRequests.map((r) => r.table_id), ...rawSessions.map((s) => s.table_id)]),
  ];

  const { data: tables } = tableIds.length
    ? await supabase.from("restaurant_tables").select("id, name").in("id", tableIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const tableNameById = new Map((tables ?? []).map((t) => [t.id, t.name]));

  const sessionIds = rawSessions.map((s) => s.id);
  const { data: guests } = sessionIds.length
    ? await supabase
        .from("guest_sessions")
        .select("table_session_id")
        .in("table_session_id", sessionIds)
    : { data: [] as Array<{ table_session_id: string }> };

  const guestCountBySession = new Map<string, number>();
  for (const guest of guests ?? []) {
    guestCountBySession.set(
      guest.table_session_id,
      (guestCountBySession.get(guest.table_session_id) ?? 0) + 1,
    );
  }

  return {
    restaurants: memberships.map((m) => ({
      restaurantId: m.restaurantId,
      name: m.restaurant.name,
    })),
    requests: rawRequests.map((r) => ({
      id: r.id,
      restaurantId: r.restaurant_id,
      restaurantName: nameById.get(r.restaurant_id) ?? "Restaurant",
      tableId: r.table_id,
      tableName: tableNameById.get(r.table_id) ?? "Table",
      partySize: r.party_size,
      requestedAt: r.requested_at,
      expiresAt: r.expires_at,
    })),
    sessions: rawSessions.map((s) => ({
      id: s.id,
      restaurantId: s.restaurant_id,
      restaurantName: nameById.get(s.restaurant_id) ?? "Restaurant",
      tableId: s.table_id,
      tableName: tableNameById.get(s.table_id) ?? "Table",
      approvedAt: s.approved_at,
      guestCount: guestCountBySession.get(s.id) ?? 0,
    })),
  };
}

export interface AdminTableRow {
  id: string;
  name: string;
  isActive: boolean;
  sessionStatus: "none" | "pending" | "active" | "closed";
  guestCount: number;
  createdAt: string;
}

/** Tables of one restaurant with their live session status for the admin workspace. */
export async function getTablesForRestaurant(restaurantId: string): Promise<AdminTableRow[]> {
  const supabase = await createClient();

  const [tablesRes, sessionsRes] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("id, name, is_active, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("table_sessions")
      .select("id, table_id, status")
      .eq("restaurant_id", restaurantId)
      .in("status", ["pending", "active"]),
  ]);

  const tables = tablesRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: guests } = sessionIds.length
    ? await supabase
        .from("guest_sessions")
        .select("table_session_id")
        .in("table_session_id", sessionIds)
    : { data: [] as Array<{ table_session_id: string }> };

  const guestCountBySession = new Map<string, number>();
  for (const guest of guests ?? []) {
    guestCountBySession.set(
      guest.table_session_id,
      (guestCountBySession.get(guest.table_session_id) ?? 0) + 1,
    );
  }

  const sessionByTable = new Map(sessions.map((s) => [s.table_id, s]));

  return tables.map((table) => {
    const session = sessionByTable.get(table.id);
    return {
      id: table.id,
      name: table.name,
      isActive: table.is_active,
      sessionStatus: session?.status ?? "none",
      guestCount: session ? (guestCountBySession.get(session.id) ?? 0) : 0,
      createdAt: table.created_at,
    };
  });
}
