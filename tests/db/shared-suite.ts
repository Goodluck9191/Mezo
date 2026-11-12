/**
 * Schema and RLS verification for the Mezo Phase 2 database.
 *
 * The exact same checks run against in-memory PostgreSQL (PGlite, default)
 * and against the mezo-staging Supabase project. With `SET ROLE` +
 * `request.jwt.claim.sub`, the identities used here mirror Supabase's
 * authenticated, anonymous and service-role clients. No policy is trusted
 * without being exercised.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { expectSqlFailure, queryRows, runAs } from "./harness";
import { buildWorld, type World } from "./fixtures";

/**
 * Registers the suite. `target` selects the connection:
 * "pglite" boots in-memory PostgreSQL with the auth shim; "staging" uses the
 * hosted staging project (migrations must already be applied).
 */
export function registerDatabaseSecuritySuite(target: "pglite" | "staging") {
  let world: World;

  beforeAll(async () => {
    world = await buildWorld(target);
  }, 120_000);

  afterAll(async () => {
    await world.db.close();
  });

  const expectPermission = (failure: { code?: string; message: string }) =>
    expect(
      failure.code === "42501" || /permission denied|staff|administrator/i.test(failure.message),
      `expected a permission failure, got: ${failure.message}`,
    ).toBe(true);

  describe("schema integrity", () => {
    it("enables RLS on every table in the public schema", async () => {
      const unprotected = await queryRows<{ relname: string }>(
        world.db,
        "service_role",
        null,
        `select relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and not c.relrowsecurity
       order by 1`,
      );
      expect(unprotected).toEqual([]);
    });

    it("creates all 22 tables and the 5 seeded plans", async () => {
      // information_schema is filtered by privileges for non-superusers, so
      // check table existence as the service role.
      const tables = await queryRows<{ table_name: string }>(
        world.db,
        "service_role",
        null,
        "select table_name from information_schema.tables where table_schema = 'public' order by 1",
      );
      for (const name of [
        "profiles",
        "platform_admins",
        "restaurants",
        "restaurant_members",
        "restaurant_applications",
        "restaurant_tables",
        "menu_categories",
        "menu_items",
        "table_sessions",
        "guest_sessions",
        "orders",
        "order_items",
        "order_events",
        "waiter_requests",
        "payments",
        "payment_attempts",
        "payment_webhook_events",
        "subscription_plans",
        "restaurant_subscriptions",
        "subscription_payments",
        "audit_logs",
        "public_restaurants",
      ]) {
        expect(tables.map((t) => t.table_name)).toContain(name);
      }

      const plans = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select count(*)::int as n from public.subscription_plans where is_active",
      );
      expect(plans[0]?.n).toBe(5);
    });

    it("creates a profile for every new auth user", async () => {
      const rows = await queryRows(
        world.db,
        "authenticated",
        world.guest1.id,
        "select id from public.profiles where id = $1",
        [world.guest1.id],
      );
      expect(rows).toHaveLength(1);
    });

    it("generates 64-hex random QR tokens, never sequential ids", async () => {
      const tokens = await queryRows<{ qr_token: string }>(
        world.db,
        "service_role",
        null,
        "select qr_token from public.restaurant_tables",
      );
      const seen = new Set(tokens.map((t) => t.qr_token));
      expect(seen.size).toBe(tokens.length);
      for (const token of seen) expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("rejects an invalid QR token format and duplicate tokens", async () => {
      const invalid = await expectSqlFailure(
        world.db,
        "service_role",
        null,
        "insert into public.restaurant_tables (restaurant_id, name, qr_token) values ($1, 'X', 'abc')",
        [world.restaurantA],
      );
      expect(invalid.message).toMatch(/check/i);

      const first = await expectSqlFailure(
        world.db,
        "service_role",
        null,
        "insert into public.restaurant_tables (restaurant_id, name, qr_token) values ($1, 'Y', $2)",
        [world.restaurantA, world.qrA1],
      );
      expect(first.message).toMatch(/unique/i);
    });

    it("enforces the Starter plan table limit (5 tables)", async () => {
      for (let index = 2; index <= 5; index += 1) {
        await runAs(
          world.db,
          "service_role",
          null,
          "insert into public.restaurant_tables (restaurant_id, name) values ($1, $2)",
          [world.restaurantC, `Limit ${index}`],
        );
      }

      const failure = await expectSqlFailure(
        world.db,
        "service_role",
        null,
        "insert into public.restaurant_tables (restaurant_id, name) values ($1, 'Over the limit')",
        [world.restaurantC],
      );
      expect(failure.message).toMatch(/table limit reached/i);
    });

    it("snapshots table_limit from the plan, not from the client", async () => {
      const before = await queryRows<{ table_limit: number }>(
        world.db,
        "service_role",
        null,
        "select table_limit from public.restaurant_subscriptions where restaurant_id = $1",
        [world.restaurantC],
      );
      expect(before[0]?.table_limit).toBe(5);

      await runAs(
        world.db,
        "service_role",
        null,
        "update public.restaurant_subscriptions set plan_id = $1 where restaurant_id = $2",
        [world.growthPlanId, world.restaurantC],
      );

      const after = await queryRows<{ table_limit: number }>(
        world.db,
        "service_role",
        null,
        "select table_limit from public.restaurant_subscriptions where restaurant_id = $1",
        [world.restaurantC],
      );
      expect(after[0]?.table_limit).toBe(20);
    });

    it("prevents clients from raising their own subscription table limit", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminB.id,
        "update public.restaurant_subscriptions set table_limit = 9999 where restaurant_id = $1",
        [world.restaurantB],
      );
      expectPermission(failure);
    });
  });

  describe("restaurant application review", () => {
    let applicationId: string;

    it("anonymous users cannot submit an application", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.applicant.id,
        "select * from public.apply_for_restaurant($1, $2, $3)",
        ["Anonymous exploit", "anonymous-exploit", "should fail"],
        true, // isAnonymous
      );
      expect(failure.message.toLowerCase()).toMatch(/anonymous/);
    });

    it("unauthenticated users cannot submit an application", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        null,
        "select * from public.apply_for_restaurant($1, $2, $3)",
        ["No session exploit", "no-session-exploit", "should fail"],
      );
      expectPermission(failure);
    });

    it("is created by the applicant, never by staff", async () => {
      const result = await runAs(
        world.db,
        "authenticated",
        world.applicant.id,
        "select * from public.apply_for_restaurant($1, $2, $3)",
        ["Coastal Grill", "coastal-grill", "Fresh seafood dining"],
      );
      expect((result.rows as Array<{ status: string }>)[0]?.status).toBe("pending");

      applicationId = (result.rows as Array<{ id: string }>)[0]!.id;
      const restaurants = await queryRows<{
        application_status: string;
        operational_status: string;
      }>(
        world.db,
        "service_role",
        null,
        "select application_status, operational_status from public.restaurants where slug = 'coastal-grill'",
      );
      expect(restaurants[0]).toMatchObject({
        application_status: "pending",
        operational_status: "suspended",
      });
    });

    it("is invisible to strangers but readable by the applicant", async () => {
      const stranger = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.restaurant_applications where id = $1",
        [applicationId],
      );
      expect(stranger).toHaveLength(0);

      const own = await queryRows(
        world.db,
        "authenticated",
        world.applicant.id,
        "select id from public.restaurant_applications where id = $1",
        [applicationId],
      );
      expect(own).toHaveLength(1);
    });

    it("cannot be reviewed by a restaurant admin", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.review_restaurant_application($1, 'approved'::public.application_status, $2, null)",
        [applicationId, world.growthPlanId],
      );
      expectPermission(failure);
    });

    it("is approved by a platform admin: restaurant activates, subscription and admin membership created", async () => {
      await runAs(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.review_restaurant_application($1, 'approved'::public.application_status, $2, null)",
        [applicationId, world.growthPlanId],
      );

      const restaurant = await queryRows<{
        application_status: string;
        operational_status: string;
      }>(
        world.db,
        "service_role",
        null,
        "select application_status, operational_status from public.restaurants where slug = 'coastal-grill'",
      );
      expect(restaurant[0]).toMatchObject({
        application_status: "approved",
        operational_status: "active",
      });

      const members = await queryRows(
        world.db,
        "service_role",
        null,
        "select role from public.restaurant_members rm join public.restaurants r on r.id = rm.restaurant_id where r.slug = 'coastal-grill' and rm.user_id = $1",
        [world.applicant.id],
      );
      expect(members).toEqual([{ role: "restaurant_admin" }]);

      const subscription = await queryRows<{ table_limit: number; status: string }>(
        world.db,
        "service_role",
        null,
        "select s.table_limit, s.status from public.restaurant_subscriptions s join public.restaurants r on r.id = s.restaurant_id where r.slug = 'coastal-grill'",
      );
      expect(subscription[0]).toMatchObject({ table_limit: 20, status: "active" });
    });

    it("cannot be approved twice", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.review_restaurant_application($1, 'approved'::public.application_status, $2, null)",
        [applicationId, world.growthPlanId],
      );
      expect(failure.message).toMatch(/already reviewed/i);
    });

    it("records review decisions in the audit log, invisible to restaurant admins", async () => {
      const adminView = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.audit_logs",
      );
      expect(adminView).toHaveLength(0);

      const platformView = await queryRows(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select action from public.audit_logs where entity_id = $1",
        [applicationId],
      );
      expect(platformView).toEqual([{ action: "restaurant_application.approved" }]);
    });

    it("rejects a second application and keeps the restaurant out of service", async () => {
      const result = await runAs(
        world.db,
        "authenticated",
        world.rejectee.id,
        "select * from public.apply_for_restaurant($1, $2)",
        ["Reject Grill", "reject-grill"],
      );
      const rejectApplicationId = (result.rows as Array<{ id: string }>)[0]!.id;

      const missingReason = await expectSqlFailure(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.review_restaurant_application($1, 'rejected'::public.application_status, null, null)",
        [rejectApplicationId],
      );
      expect(missingReason.message).toMatch(/rejection reason/i);

      await runAs(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.review_restaurant_application($1, 'rejected'::public.application_status, null, $2)",
        [rejectApplicationId, "Insufficient details"],
      );

      const restaurant = await queryRows<{
        application_status: string;
        operational_status: string;
      }>(
        world.db,
        "service_role",
        null,
        "select application_status, operational_status from public.restaurants where slug = 'reject-grill'",
      );
      expect(restaurant[0]).toMatchObject({
        application_status: "rejected",
        operational_status: "suspended",
      });

      const publicView = await queryRows(
        world.db,
        "anon",
        null,
        "select id from public.public_restaurants where slug = 'reject-grill'",
      );
      expect(publicView).toHaveLength(0);
    });
  });

  describe("QR scan and table session lifecycle", () => {
    let sessionId: string;
    let guestSessionId: string;
    let orderId: string;

    it("rejects an unknown QR token", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.guest1.id,
        "select * from public.request_table_session($1, 2)",
        ["deadbeef".repeat(8)],
      );
      expect(failure.message).toMatch(/invalid table code/i);
    });

    it("creates a pending session for the first guest", async () => {
      const result = await runAs(
        world.db,
        "authenticated",
        world.guest1.id,
        "select * from public.request_table_session($1, 2)",
        [world.qrA1],
      );
      const session = (result.rows as Array<{ id: string; status: string; table_id: string }>)[0]!;
      expect(session.status).toBe("pending");
      sessionId = session.id;

      const guestSessions = await queryRows<{ id: string }>(
        world.db,
        "service_role",
        null,
        "select id from public.guest_sessions where table_session_id = $1 and user_id = $2",
        [sessionId, world.guest1.id],
      );
      expect(guestSessions).toHaveLength(1);
      guestSessionId = guestSessions[0]!.id;
    });

    it("joins the same pending session for the second guest", async () => {
      const result = await runAs(
        world.db,
        "authenticated",
        world.guest2.id,
        "select * from public.request_table_session($1, 2)",
        [world.qrA1],
      );
      const session = (result.rows as Array<{ id: string; status: string }>)[0]!;
      expect(session.id).toBe(sessionId);
      expect(session.status).toBe("pending");
    });

    it("allows only one open session per table, even at the database level", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "service_role",
        null,
        "insert into public.table_sessions (restaurant_id, table_id, status) values ($1, $2, 'pending')",
        [world.restaurantA, world.tableA1],
      );
      expect(failure.message).toMatch(/unique|table_sessions_one_open_per_table/i);
    });

    it("blocks orders while the session is pending", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.guest1.id,
        `insert into public.orders (restaurant_id, table_session_id, guest_session_id, notes)
       values ($1, $2, $3, 'less pedas')`,
        [world.restaurantA, sessionId, guestSessionId],
      );
      expect(failure.message.toLowerCase()).toMatch(/row-level security|row violates/i);
    });

    it("lets a waiter see and approve the session", async () => {
      const before = await queryRows(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select status from public.table_sessions where id = $1",
        [sessionId],
      );
      expect(before[0]).toEqual({ status: "pending" });

      const result = await runAs(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select * from public.approve_table_session($1)",
        [sessionId],
      );
      expect((result.rows as Array<{ status: string }>)[0]?.status).toBe("active");
    });

    it("rejects approval by non-staff (a guest)", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.guest2.id,
        "select public.approve_table_session($1)",
        [sessionId],
      );
      expectPermission(failure);
    });

    it("lets the guest place an order once the session is active", async () => {
      const result = await runAs(
        world.db,
        "authenticated",
        world.guest1.id,
        `insert into public.orders (restaurant_id, table_session_id, guest_session_id, notes)
       values ($1, $2, $3, 'less pedas')
       returning id, status, subtotal_tzs, total_tzs`,
        [world.restaurantA, sessionId, guestSessionId],
      );
      const order = (result.rows as Array<{ id: string; status: string }>)[0]!;
      expect(order.status).toBe("placed");
      orderId = order.id;
    });

    it("snapshots the item price and name from the menu, ignoring client values", async () => {
      const result = await runAs(
        world.db,
        "authenticated",
        world.guest1.id,
        `insert into public.order_items (restaurant_id, order_id, menu_item_id, name_snapshot, unit_price_tzs, quantity)
       values ($1, $2, $3, 'Spoofed Name', 1, 2)
       returning name_snapshot, unit_price_tzs::int, subtotal_tzs::int`,
        [world.restaurantA, orderId, world.itemA],
      );
      expect(result.rows[0]).toMatchObject({
        name_snapshot: "Pilau",
        unit_price_tzs: 12000,
        subtotal_tzs: 24000,
      });
    });

    it("recomputes the order total from items, never from the menu", async () => {
      const order = await queryRows(
        world.db,
        "authenticated",
        world.guest1.id,
        "select subtotal_tzs::int, total_tzs::int from public.orders where id = $1",
        [orderId],
      );
      expect(order[0]).toEqual({ subtotal_tzs: 24000, total_tzs: 24000 });

      // Menu price changes afterwards must not rewrite history.
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.menu_items set price_tzs = 999999 where id = $1",
        [world.itemA],
      );

      const after = await queryRows(
        world.db,
        "authenticated",
        world.guest1.id,
        "select subtotal_tzs::int, total_tzs::int from public.orders where id = $1",
        [orderId],
      );
      expect(after[0]).toEqual({ subtotal_tzs: 24000, total_tzs: 24000 });
    });

    it("forces placed orders to status=placed with zeroed totals", async () => {
      const result = await runAs(
        world.db,
        "authenticated",
        world.guest1.id,
        `insert into public.orders (restaurant_id, table_session_id, guest_session_id, status, subtotal_tzs, total_tzs)
       values ($1, $2, $3, 'ready', 999999, 999999)
       returning status, subtotal_tzs::int, total_tzs::int`,
        [world.restaurantA, sessionId, guestSessionId],
      );
      expect(result.rows[0]).toEqual({ status: "placed", subtotal_tzs: 0, total_tzs: 0 });
    });

    it("does not let the other guest read this guest's orders or items", async () => {
      const orders = await queryRows(
        world.db,
        "authenticated",
        world.guest2.id,
        "select id from public.orders where id = $1",
        [orderId],
      );
      expect(orders).toHaveLength(0);

      const items = await queryRows(
        world.db,
        "authenticated",
        world.guest2.id,
        "select id from public.order_items where order_id = $1",
        [orderId],
      );
      expect(items).toHaveLength(0);
    });

    it("enforces the status state machine for kitchen staff", async () => {
      const skipped = await expectSqlFailure(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "update public.orders set status = 'preparing' where id = $1",
        [orderId],
      );
      expect(skipped.message).toMatch(/invalid order status transition/i);

      for (const status of ["accepted", "preparing", "ready"] as const) {
        await runAs(
          world.db,
          "authenticated",
          world.kitchenA.id,
          "update public.orders set status = $1 where id = $2",
          [status, orderId],
        );
      }

      const cancel = await expectSqlFailure(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "update public.orders set status = 'cancelled' where id = $1",
        [orderId],
      );
      expectPermission(cancel);

      const serve = await expectSqlFailure(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "update public.orders set status = 'served' where id = $1",
        [orderId],
      );
      expectPermission(serve);
    });

    it("records order events for the guest and the waiter", async () => {
      const guestEvents = await queryRows<{ event_type: string }>(
        world.db,
        "authenticated",
        world.guest1.id,
        "select event_type from public.order_events where order_id = $1 order by created_at",
        [orderId],
      );
      expect(guestEvents.map((e) => e.event_type)).toEqual([
        "created",
        "status_changed",
        "status_changed",
        "status_changed",
      ]);

      const waiterEvents = await queryRows(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select count(*)::int as n from public.order_events where order_id = $1",
        [orderId],
      );
      expect(waiterEvents[0]?.n).toBe(4);

      const blocked = await expectSqlFailure(
        world.db,
        "authenticated",
        world.guest1.id,
        "insert into public.order_events (restaurant_id, order_id, event_type) values ($1, $2, 'note')",
        [world.restaurantA, orderId],
      );
      expectPermission(blocked);
    });

    it("order items cannot mix restaurants (snapshot trigger and FK)", async () => {
      // Cross-restaurant menu item is rejected by the snapshot trigger.
      const wrongItem = await expectSqlFailure(
        world.db,
        "service_role",
        null,
        "insert into public.order_items (restaurant_id, order_id, menu_item_id, name_snapshot, unit_price_tzs, quantity) values ($1, $2, $3, 'x', 1, 1)",
        [world.restaurantA, orderId, world.itemB],
      );
      expect(wrongItem.message).toMatch(/does not belong/i);

      // Item and order from different restaurants violate the composite FK.
      const fkMismatch = await expectSqlFailure(
        world.db,
        "service_role",
        null,
        "insert into public.order_items (restaurant_id, order_id, menu_item_id, name_snapshot, unit_price_tzs, quantity) values ($1, $2, $3, 'x', 1, 1)",
        [world.restaurantB, orderId, world.itemB],
      );
      expect(fkMismatch.message).toMatch(/foreign key/i);
    });

    it("lets a waiter close the session", async () => {
      const result = await runAs(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select * from public.close_table_session($1)",
        [sessionId],
      );
      expect((result.rows as Array<{ status: string }>)[0]?.status).toBe("closed");

      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.guest1.id,
        `insert into public.orders (restaurant_id, table_session_id, guest_session_id)
       values ($1, $2, $3)`,
        [world.restaurantA, sessionId, guestSessionId],
      );
      expect(failure.message.toLowerCase()).toMatch(/row-level security|row violates/i);
    });
  });

  describe("tenant isolation", () => {
    it("admin of A cannot see, change or add data for restaurant B", async () => {
      const bRestaurant = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.restaurants where id = $1",
        [world.restaurantB],
      );
      expect(bRestaurant).toHaveLength(0);

      const bTables = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.restaurant_tables where restaurant_id = $1",
        [world.restaurantB],
      );
      expect(bTables).toHaveLength(0);

      const bOrders = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.orders where restaurant_id = $1",
        [world.restaurantB],
      );
      expect(bOrders).toHaveLength(0);

      // Public menu data is meant to be visible; hidden items must not be.
      const hiddenCategories = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.menu_categories where restaurant_id = $1 and not is_active",
        [world.restaurantB],
      );
      expect(hiddenCategories).toHaveLength(0);

      // ...but the public ones are, because the menu is public.
      const publicCategories = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.menu_categories where restaurant_id = $1",
        [world.restaurantB],
      );
      expect(publicCategories.length).toBeGreaterThan(0);

      const updated = await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.restaurants set name = 'Hacked' where id = $1",
        [world.restaurantB],
      );
      expect(updated.affectedRows).toBe(0);

      const inserted = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.menu_categories (restaurant_id, name) values ($1, 'Hacked')",
        [world.restaurantB],
      );
      expectPermission(inserted);
    });

    it("waiter A cannot administer or read restaurant B", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.waiterA.id,
        "insert into public.restaurant_members (restaurant_id, user_id, role) values ($1, $2, 'kitchen')",
        [world.restaurantB, world.waiterB.id],
      );
      expectPermission(failure);

      const rows = await queryRows(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select id from public.restaurant_members where restaurant_id = $1",
        [world.restaurantB],
      );
      expect(rows).toHaveLength(0);
    });

    it("kitchen staff cannot approve a pending session", async () => {
      // A fresh pending session exists for table A2 at this point in the file.
      await runAs(
        world.db,
        "service_role",
        null,
        "insert into public.table_sessions (restaurant_id, table_id, status) values ($1, $2, 'pending')",
        [world.restaurantA, world.tableA2],
      );

      const pending = await queryRows(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "select id from public.table_sessions where table_id = $1 and status = 'pending'",
        [world.tableA2],
      );
      expect(pending).toHaveLength(1);

      try {
        const member = await expectSqlFailure(
          world.db,
          "authenticated",
          world.kitchenA.id,
          "insert into public.restaurant_members (restaurant_id, user_id, role) values ($1, $2, 'kitchen')",
          [world.restaurantA, world.kitchenA.id],
        );
        expectPermission(member);

        const approve = await expectSqlFailure(
          world.db,
          "authenticated",
          world.kitchenA.id,
          "select public.approve_table_session($1)",
          [(pending[0] as { id: string }).id],
        );
        expectPermission(approve);
      } finally {
        // Table A2 was only used for this test; keep subsequent tests isolated.
        await runAs(
          world.db,
          "service_role",
          null,
          "delete from public.table_sessions where table_id = $1",
          [world.tableA2],
        );
      }
    });

    it("platform admins cannot see operational data, only platform data", async () => {
      const orders = await queryRows(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select id from public.orders",
      );
      expect(orders).toHaveLength(0);

      const tables = await queryRows(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select id from public.restaurant_tables",
      );
      expect(tables).toHaveLength(0);

      const subscriptions = await queryRows(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select id from public.restaurant_subscriptions",
      );
      expect(subscriptions.length).toBeGreaterThan(0);
    });

    it("all private tables are blocked for anonymous users", { timeout: 120_000 }, async () => {
      // Probe every table inside a single transaction so cross-pool leakage
      // is impossible and the network round-trips stay bounded.
      await world.db.exec("begin; set local role anon;");
      const failures: string[] = [];
      for (const table of [
        "profiles",
        "platform_admins",
        "restaurants",
        "restaurant_members",
        "restaurant_applications",
        "restaurant_tables",
        "table_sessions",
        "guest_sessions",
        "orders",
        "order_items",
        "order_events",
        "waiter_requests",
        "payments",
        "payment_attempts",
        "payment_webhook_events",
        "restaurant_subscriptions",
        "subscription_payments",
        "audit_logs",
      ]) {
        await world.db.exec("savepoint anon_probe");
        try {
          await world.db.query(`select * from public.${table} limit 1`);
          failures.push(`anon could select public.${table}`);
          await world.db.exec("rollback to savepoint anon_probe");
        } catch {
          await world.db.exec("rollback to savepoint anon_probe");
        }
      }
      await world.db.exec("commit;");
      expect(failures, failures.join("\n")).toEqual([]);
    });

    it("anonymous users can browse the public catalogue", async () => {
      const restaurants = await queryRows(
        world.db,
        "anon",
        null,
        "select name from public.public_restaurants order by name",
      );
      expect(restaurants.length).toBeGreaterThanOrEqual(3);

      const items = await queryRows(
        world.db,
        "anon",
        null,
        "select name from public.menu_items where restaurant_id = $1",
        [world.restaurantA],
      );
      expect(items).toEqual([{ name: "Pilau" }]);

      const plans = await queryRows(
        world.db,
        "anon",
        null,
        "select count(*)::int as n from public.subscription_plans",
      );
      expect(plans[0]?.n).toBe(5);
    });

    it("audit_logs is readable by platform admins only and never client-writable", async () => {
      const adminView = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.audit_logs",
      );
      expect(adminView).toHaveLength(0);

      const platformView = await queryRows(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select id from public.audit_logs",
      );
      expect(platformView.length).toBeGreaterThan(0);

      const insert = await expectSqlFailure(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "insert into public.audit_logs (actor_user_id, action, entity_type) values ($1, 'test', 'test')",
        [world.platformAdmin.id],
      );
      expectPermission(insert);
    });

    it("protects the platform-admin review fields of restaurants", async () => {
      // Lifecycle columns are not granted to any client role at all; the only
      // supported mutation paths are SECURITY DEFINER RPCs and the service role.
      const attempts: Array<[string, string]> = [
        ["operational_status", "'suspended'"],
        ["application_status", "'pending'"],
        ["subscription_status", "'expired'"],
        ["approved_at", "now()"],
        ["approved_by", "null"],
      ];
      for (const [column, value] of attempts) {
        for (const identity of [world.adminA.id, world.platformAdmin.id]) {
          const failure = await expectSqlFailure(
            world.db,
            "authenticated",
            identity,
            `update public.restaurants set ${column} = ${value} where id = $1`,
            [world.restaurantA],
          );
          expectPermission(failure);
        }
      }
    });

    it("restaurant admins can update their own restaurant profile but not the platform fields", async () => {
      const updated = await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.restaurants set description = 'Updated description' where id = $1",
        [world.restaurantA],
      );
      expect(updated.affectedRows).toBe(1);
    });

    it("kitchen and waiter cannot read subscription or audit tables", async () => {
      for (const role of [world.waiterA, world.kitchenA]) {
        const subscriptions = await queryRows(
          world.db,
          "authenticated",
          role.id,
          "select id from public.restaurant_subscriptions",
        );
        expect(subscriptions).toHaveLength(0);

        const paymentAttempts = await queryRows(
          world.db,
          "authenticated",
          role.id,
          "select id from public.payment_attempts",
        );
        expect(paymentAttempts).toHaveLength(0);
      }
    });
  });

  describe("payments and requests surface", () => {
    let paymentSession: string;
    let paymentGuest: string;

    it("creates an active session with a guest and a payment as the server would", async () => {
      paymentSession = crypto.randomUUID();
      paymentGuest = crypto.randomUUID();
      const paymentId = crypto.randomUUID();

      await runAs(
        world.db,
        "service_role",
        null,
        `insert into public.table_sessions
         (id, restaurant_id, table_id, status, party_size, approved_at, approved_by)
       values ($1, $2, $3, 'active', 2, now(), $4)`,
        [paymentSession, world.restaurantA, world.tableA2, world.platformAdmin.id],
      );

      await runAs(
        world.db,
        "service_role",
        null,
        `insert into public.guest_sessions (id, restaurant_id, table_session_id, user_id)
       values ($1, $2, $3, $4)`,
        [paymentGuest, world.restaurantA, paymentSession, world.guest1.id],
      );

      await runAs(
        world.db,
        "service_role",
        null,
        `insert into public.payments (id, restaurant_id, table_session_id, amount_tzs, status)
       values ($1, $2, $3, 24000, 'pending')`,
        [paymentId, world.restaurantA, paymentSession],
      );

      const waiterView = await queryRows(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select id from public.payments where id = $1",
        [paymentId],
      );
      expect(waiterView).toHaveLength(1);

      const kitchenView = await queryRows(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "select id from public.payments where id = $1",
        [paymentId],
      );
      expect(kitchenView).toHaveLength(0);

      const guestView = await queryRows(
        world.db,
        "authenticated",
        world.guest1.id,
        "select id from public.payments where id = $1",
        [paymentId],
      );
      expect(guestView).toHaveLength(1);

      const otherRestaurant = await queryRows(
        world.db,
        "authenticated",
        world.adminB.id,
        "select id from public.payments where id = $1",
        [paymentId],
      );
      expect(otherRestaurant).toHaveLength(0);

      await runAs(
        world.db,
        "service_role",
        null,
        "delete from public.table_sessions where id = $1",
        [paymentSession],
      );
    });

    it("clients cannot create payment rows directly", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.payments (restaurant_id, table_session_id, amount_tzs) values ($1, $2, 100)",
        [world.restaurantA, crypto.randomUUID()],
      );
      expectPermission(failure);
    });

    it("webhook events are restricted to platform admins, including restaurants not of A", async () => {
      const admin = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.payment_webhook_events",
      );
      expect(admin).toHaveLength(0);

      const platformAdmin = await queryRows(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select id from public.payment_webhook_events",
      );
      expect(Array.isArray(platformAdmin)).toBe(true);
    });

    it("server role can read everything", async () => {
      const rows = await queryRows(
        world.db,
        "service_role",
        null,
        "select count(*)::int as n from public.restaurants",
      );
      expect(rows[0]!.n).toBeGreaterThanOrEqual(3);
    });
  });
}
