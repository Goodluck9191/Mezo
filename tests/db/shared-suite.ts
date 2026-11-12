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

  describe("phase 4 — restaurant profile and staff invitations", () => {
    let inviteToken: string | undefined;
    let secondInviteId: string | undefined;
    let inviteeUserId: string | undefined;

    it("lets a restaurant admin update their own restaurant profile", async () => {
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.restaurants set name = $2, description = $3 where id = $1",
        [world.restaurantA, "Demo Cafe Updated", "Best pilau in town"],
      );

      const rows = await queryRows(
        world.db,
        "service_role",
        null,
        "select name, description from public.restaurants where id = $1",
        [world.restaurantA],
      );
      expect(rows[0]).toMatchObject({
        name: "Demo Cafe Updated",
        description: "Best pilau in town",
      });
    });

    it("blocks a restaurant admin from changing application_status", async () => {
      // Direct UPDATE of lifecycle columns is refused at the privilege level
      // (only owner-editable columns are granted), and the review trigger
      // would also raise 42501 — both are acceptable denials here.
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.restaurants set application_status = 'pending' where id = $1",
        [world.restaurantA],
      );
      expect(
        failure.code === "42501" || /permission denied/i.test(failure.message),
        `expected a permission failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("never allows direct writes to lifecycle columns — lifecycles move through the review RPC only", async () => {
      const scratch = crypto.randomUUID();
      await world.db.query(
        "insert into public.restaurants (id, name, slug, application_status, operational_status, created_by) values ($1, $2, $3, 'pending', 'suspended', $4)",
        [scratch, "Scratch Phase 4", "scratch-phase4", world.platformAdmin.id],
      );

      // Even a platform admin cannot move lifecycle columns with a direct
      // client UPDATE: the privilege grant covers only owner-editable columns.
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "update public.restaurants set application_status = 'approved' where id = $1",
        [scratch],
      );
      expect(
        failure.code === "42501" || /permission denied/i.test(failure.message),
        `expected a permission failure, got: ${failure.message}`,
      ).toBe(true);

      // A restaurant admin of another restaurant: with a column they may
      // write (name), RLS filters the row out silently…
      await runAs(
        world.db,
        "authenticated",
        world.adminB.id,
        "update public.restaurants set name = 'Hacked Scratch' where id = $1",
        [scratch],
      );

      const untouched = await queryRows<{ name: string }>(
        world.db,
        "service_role",
        null,
        "select name from public.restaurants where id = $1",
        [scratch],
      );
      expect(untouched[0]!.name).toBe("Scratch Phase 4");

      // …and with a lifecycle column, the privilege grant refuses outright.
      const blocked = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminB.id,
        "update public.restaurants set application_status = 'approved' where id = $1",
        [scratch],
      );
      expect(
        blocked.code === "42501" || /permission denied/i.test(blocked.message),
        `expected a permission failure, got: ${blocked.message}`,
      ).toBe(true);

      await world.db.query("delete from public.restaurants where id = $1", [scratch]);
    });

    it("blocks a waiter from changing the restaurant profile (RLS)", async () => {
      await runAs(
        world.db,
        "authenticated",
        world.waiterA.id,
        "update public.restaurants set name = $2 where id = $1",
        [world.restaurantA, "Hacked Cafe A"],
      );
      const rows = await queryRows<{ name: string }>(
        world.db,
        "service_role",
        null,
        "select name from public.restaurants where id = $1",
        [world.restaurantA],
      );
      expect(rows[0]!.name).toBe("Demo Cafe Updated");
    });

    it("blocks kitchen staff from changing the restaurant profile (RLS)", async () => {
      await runAs(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "update public.restaurants set name = $2 where id = $1",
        [world.restaurantA, "Hacked Cafe A"],
      );
      const rows = await queryRows<{ name: string }>(
        world.db,
        "service_role",
        null,
        "select name from public.restaurants where id = $1",
        [world.restaurantA],
      );
      expect(rows[0]!.name).toBe("Demo Cafe Updated");
    });

    it("blocks admin A from changing restaurant B's profile even via direct SQL", async () => {
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.restaurants set name = $2 where id = $1",
        [world.restaurantB, "Hacked Cafe B"],
      );
      const rows = await queryRows<{ name: string }>(
        world.db,
        "service_role",
        null,
        "select name from public.restaurants where id = $1",
        [world.restaurantB],
      );
      expect(rows[0]!.name).toBe("Other Bistro");
    });

    it("lets a restaurant admin invite a waiter with a single-use hashed token", async () => {
      const rows = await queryRows<{
        id: string;
        email: string;
        role: string;
        status: string;
        token: string;
      }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id, email, role, status, token from public.invite_restaurant_staff($1, $2, 'waiter'::public.restaurant_role)",
        [world.restaurantA, "newhire@example.test"],
      );

      expect(rows[0]).toMatchObject({
        email: "newhire@example.test",
        role: "waiter",
        status: "pending",
      });
      inviteToken = rows[0]!.token;

      // The cleartext token must never be stored; md5 of a 244-bit random
      // token is the only stored form.
      const stored = await queryRows<{ token_hash: string }>(
        world.db,
        "service_role",
        null,
        "select token_hash from public.restaurant_staff_invitations where id = $1",
        [rows[0]!.id],
      );
      expect(stored[0]!.token_hash).not.toBe(inviteToken);
      expect(stored[0]!.token_hash).toMatch(/^[0-9a-f]{32}$/);
    });

    it("waiter cannot invite staff", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select public.invite_restaurant_staff($1, $2, 'waiter'::public.restaurant_role)",
        [world.restaurantA, "sneaky@example.test"],
      );
      expectPermission(failure);
    });

    it("kitchen cannot invite staff", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "select public.invite_restaurant_staff($1, $2, 'kitchen'::public.restaurant_role)",
        [world.restaurantA, "sneaky2@example.test"],
      );
      expectPermission(failure);
    });

    it("a restaurant admin of B cannot invite for A", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminB.id,
        "select public.invite_restaurant_staff($1, $2, 'waiter'::public.restaurant_role)",
        [world.restaurantA, "sneaky3@example.test"],
      );
      expectPermission(failure);
    });

    it("rejects restaurant_admin as an invited role", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.invite_restaurant_staff($1, $2, 'restaurant_admin'::public.restaurant_role)",
        [world.restaurantA, "sneaky4@example.test"],
      );
      expect(
        failure.code === "22023" || /waiter or kitchen/i.test(failure.message),
        `expected an invalid-role failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("rejects a duplicate pending invitation for the same email and role", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.invite_restaurant_staff($1, $2, 'waiter'::public.restaurant_role)",
        [world.restaurantA, "newhire@example.test"],
      );
      expect(
        failure.code === "23505" || /already exists/i.test(failure.message),
        `expected a duplicate failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("the invitation cannot be accepted by a different email account", async () => {
      const intruderId = crypto.randomUUID();
      // auth.users is only writable as the database owner (as in staging).
      await world.db.query(
        "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}'::jsonb)",
        [intruderId, "intruder@example.test"],
      );

      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        intruderId,
        "select public.accept_restaurant_invitation($1)",
        [inviteToken],
      );
      expect(
        failure.code === "42501" || /different email/i.test(failure.message),
        `expected an address-mismatch failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("lets the invitee accept and become an active waiter of A", async () => {
      inviteeUserId = crypto.randomUUID();
      await world.db.query(
        "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}'::jsonb)",
        [inviteeUserId, "newhire@example.test"],
      );

      const rows = await queryRows<{ restaurant_slug: string; role: string }>(
        world.db,
        "authenticated",
        inviteeUserId,
        "select restaurant_slug, role from public.accept_restaurant_invitation($1)",
        [inviteToken],
      );
      expect(rows[0]).toMatchObject({ restaurant_slug: "demo-cafe", role: "waiter" });

      const membership = await queryRows<{ role: string; is_active: boolean }>(
        world.db,
        "service_role",
        null,
        "select role, is_active from public.restaurant_members where restaurant_id = $1 and user_id = $2",
        [world.restaurantA, inviteeUserId],
      );
      expect(membership).toEqual([{ role: "waiter", is_active: true }]);
    });

    it("rejects replay of an already-used invitation token", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        inviteeUserId!,
        "select public.accept_restaurant_invitation($1)",
        [inviteToken],
      );
      expect(
        failure.code === "P0002" || /invalid, expired or already used/i.test(failure.message),
        `expected an unknown-token failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("a revoked pending invitation can no longer be accepted", async () => {
      const rows = await queryRows<{ id: string; token: string }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id, token from public.invite_restaurant_staff($1, $2, 'kitchen'::public.restaurant_role)",
        [world.restaurantA, "revoked@example.test"],
      );
      secondInviteId = rows[0]!.id;

      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.revoke_restaurant_invitation($1)",
        [secondInviteId],
      );

      // And a waiter may not revoke invitations either.
      const blocked = await expectSqlFailure(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select public.revoke_restaurant_invitation($1)",
        [secondInviteId],
      );
      expectPermission(blocked);

      const kitchenHire = crypto.randomUUID();
      await world.db.query(
        "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}'::jsonb)",
        [kitchenHire, "revoked@example.test"],
      );
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        kitchenHire,
        "select public.accept_restaurant_invitation($1)",
        [rows[0]!.token],
      );
      expect(
        failure.code === "P0002" || /invalid, expired or already used/i.test(failure.message),
        `expected an unknown-token failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("a multi-membership user acts only within the restaurant they target", async () => {
      // Grant waiterA an additional, legitimate membership in B.
      await runAs(
        world.db,
        "service_role",
        null,
        "insert into public.restaurant_members (restaurant_id, user_id, role) values ($1, $2, 'waiter')",
        [world.restaurantB, world.waiterA.id],
      );

      const visible = await queryRows(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select id from public.restaurants where id = $1",
        [world.restaurantB],
      );
      expect(visible).toHaveLength(1);

      // But waiter rights in B never extend to updating B's profile…
      await runAs(
        world.db,
        "authenticated",
        world.waiterA.id,
        "update public.restaurants set name = $2 where id = $1",
        [world.restaurantB, "Hacked Cafe B"],
      );

      // …and nothing at all in C.
      const seenC = await queryRows(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select id from public.restaurants where id = $1",
        [world.restaurantC],
      );
      expect(seenC).toHaveLength(0);

      const check = await queryRows<{ name: string }>(
        world.db,
        "service_role",
        null,
        "select name from public.restaurants where id = $1",
        [world.restaurantB],
      );
      expect(check[0]!.name).toBe("Other Bistro");

      // Restore the fixture's single-restaurant shape for the remaining checks.
      await runAs(
        world.db,
        "service_role",
        null,
        "delete from public.restaurant_members where restaurant_id = $1 and user_id = $2",
        [world.restaurantB, world.waiterA.id],
      );
    });

    it("deactivates a staff member and they immediately lose access", async () => {
      const target = await queryRows<{ id: string }>(
        world.db,
        "service_role",
        null,
        "select id from public.restaurant_members where restaurant_id = $1 and user_id = $2",
        [world.restaurantA, inviteeUserId],
      );

      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.deactivate_restaurant_member($1)",
        [target[0]!.id],
      );

      const visible = await queryRows(
        world.db,
        "authenticated",
        inviteeUserId!,
        "select id from public.restaurants where id = $1",
        [world.restaurantA],
      );
      expect(visible).toHaveLength(0);
    });

    it("a restaurant admin cannot deactivate themselves", async () => {
      const target = await queryRows<{ id: string }>(
        world.db,
        "service_role",
        null,
        "select id from public.restaurant_members where restaurant_id = $1 and user_id = $2 and role = 'restaurant_admin'",
        [world.restaurantA, world.adminA.id],
      );
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.deactivate_restaurant_member($1)",
        [target[0]!.id],
      );
      expect(
        failure.code === "22023" || /own membership/i.test(failure.message),
        `expected a self-deactivation failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("a restaurant admin cannot deactivate a member of another restaurant", async () => {
      const target = await queryRows<{ id: string }>(
        world.db,
        "service_role",
        null,
        "select id from public.restaurant_members where restaurant_id = $1 and user_id = $2",
        [world.restaurantB, world.waiterB.id],
      );
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.deactivate_restaurant_member($1)",
        [target[0]!.id],
      );
      expectPermission(failure);
    });

    it("invitations of another restaurant are invisible to this restaurant's admin", async () => {
      const rows = await queryRows(
        world.db,
        "authenticated",
        world.adminB.id,
        "select id from public.restaurant_staff_invitations where restaurant_id = $1",
        [world.restaurantA],
      );
      expect(rows).toHaveLength(0);
    });

    it("a restaurant admin cannot change the restaurant slug directly", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.restaurants set slug = 'hacked-slug' where id = $1",
        [world.restaurantA],
      );
      expect(
        failure.code === "42501" || /permission denied/i.test(failure.message),
        `expected a permission failure, got: ${failure.message}`,
      ).toBe(true);

      const rows = await queryRows<{ slug: string }>(
        world.db,
        "service_role",
        null,
        "select slug from public.restaurants where id = $1",
        [world.restaurantA],
      );
      expect(rows[0]!.slug).toBe("demo-cafe");
    });

    it("a waiter cannot change the restaurant slug directly", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.waiterA.id,
        "update public.restaurants set slug = 'hacked-slug' where id = $1",
        [world.restaurantA],
      );
      expect(
        failure.code === "42501" || /permission denied/i.test(failure.message),
        `expected a permission failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("even a platform admin cannot change the slug via a client UPDATE", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "update public.restaurants set slug = 'hacked-slug' where id = $1",
        [world.restaurantA],
      );
      expect(
        failure.code === "42501" || /permission denied/i.test(failure.message),
        `expected a permission failure, got: ${failure.message}`,
      ).toBe(true);

      const rows = await queryRows<{ slug: string }>(
        world.db,
        "service_role",
        null,
        "select slug from public.restaurants where id = $1",
        [world.restaurantA],
      );
      expect(rows[0]!.slug).toBe("demo-cafe");
    });

    it("an owner-editable field is still writable after the slug change is blocked", async () => {
      // Name is part of the owner-editable grant; the slug change must not affect it.
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.restaurants set name = 'Demo Cafe Updated' where id = $1",
        [world.restaurantA],
      );
      const rows = await queryRows<{ name: string }>(
        world.db,
        "service_role",
        null,
        "select name from public.restaurants where id = $1",
        [world.restaurantA],
      );
      expect(rows[0]!.name).toBe("Demo Cafe Updated");
    });

    it("an expired invitation cannot be accepted", async () => {
      const rows = await queryRows<{ id: string; token: string }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id, token from public.invite_restaurant_staff($1, $2, 'kitchen'::public.restaurant_role)",
        [world.restaurantA, "expired@example.test"],
      );
      await world.db.query(
        "update public.restaurant_staff_invitations set expires_at = now() - interval '1 day' where id = $1",
        [rows[0]!.id],
      );

      const invitee = crypto.randomUUID();
      await world.db.query(
        "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}'::jsonb)",
        [invitee, "expired@example.test"],
      );

      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        invitee,
        "select public.accept_restaurant_invitation($1)",
        [rows[0]!.token],
      );
      expect(
        failure.code === "P0002" || /invalid, expired or already used/i.test(failure.message),
        `expected an unknown-token failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("an anonymous session cannot accept an invitation even with a matching email", async () => {
      const rows = await queryRows<{ id: string; token: string }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id, token from public.invite_restaurant_staff($1, $2, 'waiter'::public.restaurant_role)",
        [world.restaurantA, "anonaccept@example.test"],
      );

      const anon = crypto.randomUUID();
      await world.db.query(
        "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}'::jsonb)",
        [anon, "anonaccept@example.test"],
      );

      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        anon,
        "select public.accept_restaurant_invitation($1)",
        [rows[0]!.token],
        true,
      );
      expect(
        failure.code === "42501" || /anonymous/i.test(failure.message),
        `expected an anonymous-session failure, got: ${failure.message}`,
      ).toBe(true);
    });
  });
}
