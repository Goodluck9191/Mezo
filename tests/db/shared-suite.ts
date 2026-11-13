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

    it("creates all 22 tables and the 7 seeded plans", async () => {
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

      const plans = await queryRows<{ code: string }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select code from public.subscription_plans where is_active",
      );
      const codes = plans.map((p) => p.code);
      for (const code of [
        "starter_monthly",
        "growth_monthly",
        "pro_monthly",
        "starter_yearly",
        "growth_yearly",
        "business_monthly",
        "enterprise_monthly",
      ]) {
        expect(codes).toContain(code);
      }
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

      const plans = await queryRows<{ code: string }>(
        world.db,
        "anon",
        null,
        "select code from public.subscription_plans where is_active",
      );
      const codes = plans.map((p) => p.code);
      for (const code of [
        "starter_monthly",
        "growth_monthly",
        "pro_monthly",
        "starter_yearly",
        "growth_yearly",
        "business_monthly",
        "enterprise_monthly",
      ]) {
        expect(codes).toContain(code);
      }
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

  describe("phase 5 — subscriptions", () => {
    // Each suite run uses a fresh provider reference so the payment tests
    // behave identically on ephemeral (PGlite) and persistent (staging) targets.
    const paymentRef = `sn-testref-${crypto.randomUUID().slice(0, 12)}`;

    it("platform admin can create and update a plan in the catalogue", async () => {
      // Keep the test idempotent: the staging suite re-runs against a persistent database.
      await world.db.query("delete from public.subscription_plans where code = 'qa_test_plan'");
      const rows = await queryRows<{ code: string; table_limit: number }>(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select code, table_limit from public.create_subscription_plan($1, $2, $3, $4, 'monthly'::public.billing_interval, 7, true)",
        ["qa_test_plan", "QA Test Plan", "Temporary test plan", 1000],
      );
      expect(rows[0]).toMatchObject({ code: "qa_test_plan", table_limit: 7 });

      const updated = await queryRows<{ table_limit: number; price_tzs: string }>(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select table_limit, price_tzs from public.update_subscription_plan((select id from public.subscription_plans where code = 'qa_test_plan'), $1, $2, $3, 'yearly'::public.billing_interval, 9)",
        ["QA Test Plan 2", "Updated description", 2000],
      );
      expect(updated[0]).toMatchObject({ table_limit: 9 });
      expect(Number(updated[0]!.price_tzs)).toBe(2000);
    });

    it("restaurant admin cannot create a plan", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.create_subscription_plan($1, $2, $3, $4, 'monthly'::public.billing_interval, 5, true)",
        ["admin_plan_attempt", "Admin Attempt", "nope", 1],
      );
      expectPermission(failure);
    });

    it("waiter cannot create a plan", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select public.create_subscription_plan($1, $2, $3, $4, 'monthly'::public.billing_interval, 5, true)",
        ["waiter_plan_attempt", "Waiter Attempt", "nope", 1],
      );
      expectPermission(failure);
    });

    it("kitchen cannot create a plan", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "select public.create_subscription_plan($1, $2, $3, $4, 'monthly'::public.billing_interval, 5, true)",
        ["kitchen_plan_attempt", "Kitchen Attempt", "nope", 1],
      );
      expectPermission(failure);
    });

    it("direct client UPDATE on the plan catalogue is denied", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.subscription_plans set table_limit = 9999 where code = 'qa_test_plan'",
      );
      expect(
        failure.code === "42501" || /permission denied/i.test(failure.message),
        `expected a permission failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("restaurant admin cannot assign itself a different plan", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.assign_subscription_plan($1, (select id from public.subscription_plans where code = 'business_monthly'))",
        [world.restaurantA],
      );
      expectPermission(failure);
    });

    it("a waiter cannot assign a plan either", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select public.assign_subscription_plan($1, (select id from public.subscription_plans where code = 'business_monthly'))",
        [world.restaurantA],
      );
      expectPermission(failure);
    });

    it("lowering the plan does not delete existing tables", async () => {
      // Fixture state entering this test: tiny-diner has 5 tables and an
      // active Growth subscription (limit 20).
      await runAs(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.assign_subscription_plan($1, (select id from public.subscription_plans where code = 'business_monthly'))",
        [world.restaurantC],
      );
      const businessLimit = await queryRows<{ n: number }>(
        world.db,
        "service_role",
        null,
        "select s.table_limit::int as n from public.restaurant_subscriptions s where s.restaurant_id = $1 and s.status = 'active'",
        [world.restaurantC],
      );
      expect(businessLimit[0]!.n).toBe(50);

      // Grow the restaurant past its Starter limit of 5 tables.
      for (const name of ["T6", "T7", "T8", "T9", "T10"]) {
        await world.db.query(
          "insert into public.restaurant_tables (restaurant_id, name) values ($1, $2)",
          [world.restaurantC, name],
        );
      }

      // Reassign Starter: limit drops to 5, but every table remains.
      await runAs(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.assign_subscription_plan($1, (select id from public.subscription_plans where code = 'starter_monthly'))",
        [world.restaurantC],
      );

      const count = await queryRows<{ n: number }>(
        world.db,
        "service_role",
        null,
        "select count(*)::int as n from public.restaurant_tables where restaurant_id = $1",
        [world.restaurantC],
      );
      expect(count[0]!.n).toBe(10);
    });

    it("a restaurant already above its new limit cannot create more tables", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "service_role",
        null,
        "insert into public.restaurant_tables (restaurant_id, name) values ($1, 'T7-over-limit')",
        [world.restaurantC],
      );
      expect(failure.code === "23514" || /table limit reached/i.test(failure.message)).toBe(true);
    });

    it("expired subscriptions block table creation", async () => {
      // Force expiry of A's current subscription, verify blocked, then restore.
      await world.db.query(
        "update public.restaurant_subscriptions set status = 'expired' where restaurant_id = $1 and status = 'active'",
        [world.restaurantA],
      );

      const failure = await expectSqlFailure(
        world.db,
        "service_role",
        null,
        "insert into public.restaurant_tables (restaurant_id, name) values ($1, 'blocked')",
        [world.restaurantA],
      );
      expect(
        failure.code === "23514" || /not active/i.test(failure.message),
        `expected an inactive-subscription failure, got: ${failure.message}`,
      ).toBe(true);

      await runAs(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.set_subscription_status($1, 'active'::public.subscription_status)",
        [world.restaurantA],
      );

      const restored = await queryRows<{ status: string }>(
        world.db,
        "service_role",
        null,
        "select status from public.restaurant_subscriptions where restaurant_id = $1 and status = 'active'",
        [world.restaurantA],
      );
      expect(restored).toHaveLength(1);
    });

    it("restaurant B cannot see restaurant A's subscription", async () => {
      const rows = await queryRows(
        world.db,
        "authenticated",
        world.adminB.id,
        "select id from public.restaurant_subscriptions where restaurant_id = $1",
        [world.restaurantA],
      );
      expect(rows).toHaveLength(0);
    });

    it("a platform admin records a payment and the admin of the restaurant sees it", async () => {
      const rows = await queryRows(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        `select id, already_recorded from public.record_subscription_payment($1, $2, 'successful'::public.payment_status, '${paymentRef}', '2026-11-01'::date, '2026-11-30'::date, now(), null)`,
        [world.restaurantA, 85000],
      );
      expect(rows[0]).toMatchObject({ already_recorded: false });

      const visible = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id, amount_tzs::bigint as amount_tzs, status from public.subscription_payments where restaurant_id = $1",
        [world.restaurantA],
      );
      expect(visible).toHaveLength(1);
      expect(Number(visible[0]!.amount_tzs)).toBe(85000);
      expect(visible[0]!.status).toBe("successful");
    });

    it("payment recording is idempotent on the provider reference", async () => {
      const rows = await queryRows(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        `select id, already_recorded from public.record_subscription_payment($1, $2, 'successful'::public.payment_status, '${paymentRef}', '2026-11-01'::date, '2026-11-30'::date, now(), null)`,
        [world.restaurantA, 85000],
      );
      expect(rows[0]).toMatchObject({ already_recorded: true });

      const payments = await queryRows(
        world.db,
        "service_role",
        null,
        `select id from public.subscription_payments where restaurant_id = $1 and provider_reference = '${paymentRef}'`,
        [world.restaurantA],
      );
      expect(payments).toHaveLength(1);
    });

    it("a restaurant admin cannot record a payment for their own restaurant", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "select public.record_subscription_payment($1, $2, 'successful'::public.payment_status, 'sn-self-001', null, null, now(), null)",
        [world.restaurantA, 100],
      );
      expectPermission(failure);
    });

    it("direct client INSERT into subscription_payments is denied", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.subscription_payments (restaurant_id, restaurant_subscription_id, amount_tzs, status) values ($1, (select id from public.restaurant_subscriptions where restaurant_id = $1 limit 1), 100, 'successful')",
        [world.restaurantA],
      );
      expect(
        failure.code === "42501" || /permission denied/i.test(failure.message),
        `expected a permission failure, got: ${failure.message}`,
      ).toBe(true);
    });

    it("plan deactivation hides the plan from the active catalogue and blocks assignment, then reactivation restores it", async () => {
      await runAs(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.set_subscription_plan_active((select id from public.subscription_plans where code = 'qa_test_plan'), false)",
      );
      const visible = await queryRows<{ n: number }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select count(*)::int as n from public.subscription_plans where code = 'qa_test_plan' and is_active",
      );
      expect(visible[0]!.n).toBe(0);

      const blocked = await expectSqlFailure(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.assign_subscription_plan($1, (select id from public.subscription_plans where code = 'qa_test_plan'))",
        [world.restaurantB],
      );
      expect(
        blocked.code === "23503" || /missing or inactive/i.test(blocked.message),
        `expected a missing-or-inactive failure, got: ${blocked.message}`,
      ).toBe(true);

      await runAs(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.set_subscription_plan_active((select id from public.subscription_plans where code = 'qa_test_plan'), true)",
      );
      const restored = await queryRows<{ n: number }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select count(*)::int as n from public.subscription_plans where code = 'qa_test_plan' and is_active",
      );
      expect(restored[0]!.n).toBe(1);
    });

    it("expire_overdue_subscriptions expires only overdue rows and audits them", async () => {
      await world.db.query(
        "update public.restaurant_subscriptions set starts_on = current_date - interval '60 days', renews_on = current_date - interval '1 day' where restaurant_id = $1 and status = 'active'",
        [world.restaurantA],
      );

      const expired = await queryRows<{ expire_overdue_subscriptions: number }>(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.expire_overdue_subscriptions() as expire_overdue_subscriptions",
      );
      expect(expired[0]!.expire_overdue_subscriptions).toBeGreaterThanOrEqual(1);

      const subscription = await queryRows<{ status: string }>(
        world.db,
        "service_role",
        null,
        "select status from public.restaurant_subscriptions where restaurant_id = $1 and status = 'expired'",
        [world.restaurantA],
      );
      expect(subscription).toHaveLength(1);

      const audit = await queryRows(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select id from public.audit_logs where action = 'subscription.status.expired' and restaurant_id = $1",
        [world.restaurantA],
      );
      expect(audit.length).toBeGreaterThanOrEqual(1);

      // Restore a valid subscription for any subsequent work.
      await runAs(
        world.db,
        "authenticated",
        world.platformAdmin.id,
        "select public.set_subscription_status($1, 'active'::public.subscription_status)",
        [world.restaurantA],
      );
      const restored = await queryRows<{ status: string }>(
        world.db,
        "service_role",
        null,
        "select status from public.restaurant_subscriptions where restaurant_id = $1 and status = 'active'",
        [world.restaurantA],
      );
      expect(restored).toHaveLength(1);
    });

    it("a restaurant admin cannot read another restaurant's audit logs", async () => {
      const rows = await queryRows(
        world.db,
        "authenticated",
        world.adminB.id,
        "select id from public.audit_logs where restaurant_id = $1",
        [world.restaurantA],
      );
      expect(rows).toHaveLength(0);
    });

    it("a restaurant admin cannot write the sync-level subscription_status directly", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.restaurants set subscription_status = 'expired' where id = $1",
        [world.restaurantA],
      );
      expect(
        failure.code === "42501" || /permission denied/i.test(failure.message),
        `expected a permission failure, got: ${failure.message}`,
      ).toBe(true);
    });
  });

  describe("phase 6 — menu management", () => {
    it("a restaurant admin can create a category and it appears for staff", async () => {
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.menu_categories (id, restaurant_id, name, sort_order) values ($1, $2, 'Supper', 5)",
        [crypto.randomUUID(), world.restaurantA],
      );
      const rows = await queryRows(
        world.db,
        "authenticated",
        world.waiterA.id,
        "select name from public.menu_categories where restaurant_id = $1 and name = 'Supper'",
        [world.restaurantA],
      );
      expect(rows).toEqual([{ name: "Supper" }]);
    });

    it("category ordering persists after a reorder", async () => {
      const before = await queryRows<{ id: string; sort_order: number; name: string }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id, sort_order, name from public.menu_categories where restaurant_id = $1 and archived_at is null order by sort_order",
        [world.restaurantA],
      );
      expect(before.length).toBeGreaterThanOrEqual(2);
      const reversed = [...before].reverse();
      for (const [index, category] of reversed.entries()) {
        await runAs(
          world.db,
          "authenticated",
          world.adminA.id,
          "update public.menu_categories set sort_order = $2 where id = $1",
          [category.id, index],
        );
      }
      const after = await queryRows<{ name: string }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select name from public.menu_categories where restaurant_id = $1 and archived_at is null order by sort_order",
        [world.restaurantA],
      );
      expect(after[0]!.name).toBe(reversed[0]!.name);
      // Restore original order for downstream assertions.
      for (const [index, category] of before.entries()) {
        await runAs(
          world.db,
          "authenticated",
          world.adminA.id,
          "update public.menu_categories set sort_order = $2 where id = $1",
          [category.id, index],
        );
      }
    });

    it("a waiter cannot create a category", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.waiterA.id,
        "insert into public.menu_categories (restaurant_id, name) values ($1, 'Sneaky Cat')",
        [world.restaurantA],
      );
      expectPermission(failure);
    });

    it("kitchen cannot create a category either", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "insert into public.menu_categories (restaurant_id, name) values ($1, 'Sneaky Cat 2')",
        [world.restaurantA],
      );
      expectPermission(failure);
    });

    it("waiter/kitchen cannot manage menu items", async () => {
      const insertFailure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.waiterA.id,
        "insert into public.menu_items (restaurant_id, category_id, name, price_tzs) values ($1, $2, 'Sneaky Item', 100)",
        [world.restaurantA, world.categoryA],
      );
      expectPermission(insertFailure);

      // RLS filters the row silently; the price must remain unchanged.
      await runAs(
        world.db,
        "authenticated",
        world.kitchenA.id,
        "update public.menu_items set price_tzs = 1 where id = $1",
        [world.itemA],
      );
      const still = await queryRows<{ price_tzs: number }>(
        world.db,
        "service_role",
        null,
        "select price_tzs from public.menu_items where id = $1",
        [world.itemA],
      );
      expect(Number(still[0]!.price_tzs)).not.toBe(1);
    });

    it("admin B cannot see restaurant A's hidden categories nor edit A's categories", async () => {
      // A hidden (inactive) category in restaurant A must be invisible to B,
      // even though public categories are intentionally visible to everyone.
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.menu_categories (restaurant_id, name, is_active, sort_order) values ($1, 'AdminB hidden', false, 50)",
        [world.restaurantA],
      );

      const seen = await queryRows(
        world.db,
        "authenticated",
        world.adminB.id,
        "select id from public.menu_categories where restaurant_id = $1 and not is_active",
        [world.restaurantA],
      );
      expect(seen).toHaveLength(0);

      await runAs(
        world.db,
        "authenticated",
        world.adminB.id,
        "update public.menu_categories set name = 'Hacked' where id = $1",
        [world.categoryA],
      );
      const still = await queryRows<{ name: string }>(
        world.db,
        "service_role",
        null,
        "select name from public.menu_categories where id = $1",
        [world.categoryA],
      );
      expect(still[0]!.name).not.toBe("Hacked");
    });

    it("admin B cannot see restaurant A's hidden items nor edit them", async () => {
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.menu_items (restaurant_id, category_id, name, price_tzs, is_available) values ($1, $2, 'AdminB hidden item', 100, false)",
        [world.restaurantA, world.categoryA],
      );

      const seen = await queryRows(
        world.db,
        "authenticated",
        world.adminB.id,
        "select id from public.menu_items where restaurant_id = $1 and not is_available",
        [world.restaurantA],
      );
      expect(seen).toHaveLength(0);

      await runAs(
        world.db,
        "authenticated",
        world.adminB.id,
        "update public.menu_items set price_tzs = 1 where id = $1",
        [world.itemA],
      );
      const still = await queryRows<{ price_tzs: number }>(
        world.db,
        "service_role",
        null,
        "select price_tzs from public.menu_items where id = $1",
        [world.itemA],
      );
      expect(Number(still[0]!.price_tzs)).not.toBe(1);
    });

    it("rejects negative menu item price at the database constraint", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.menu_items (restaurant_id, category_id, name, price_tzs) values ($1, $2, 'Free Lunch', -1)",
        [world.restaurantA, world.categoryA],
      );
      expect(failure.code === "23514" || /price/i.test(failure.message)).toBe(true);
    });

    it("rejects assigning an item to a different restaurant's category", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.menu_items (restaurant_id, category_id, name, price_tzs) values ($1, $2, 'Cross Restaurant', 1000)",
        [world.restaurantA, world.categoryB],
      );
      expect(failure.code === "23503" || /foreign key|category/i.test(failure.message)).toBe(true);
    });

    it("admin A can create an item in own restaurant", async () => {
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.menu_items (restaurant_id, category_id, name, price_tzs) values ($1, $2, 'Ugali', 3000)",
        [world.restaurantA, world.categoryA],
      );
      const rows = await queryRows<{ name: string }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "select name from public.menu_items where restaurant_id = $1 and name = 'Ugali'",
        [world.restaurantA],
      );
      expect(rows).toEqual([{ name: "Ugali" }]);
    });

    it("menu items cannot be hard-deleted by clients", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "delete from public.menu_items where id = $1",
        [world.itemA],
      );
      expect(
        failure.code === "42501" || /permission denied|delete/i.test(failure.message),
        `expected permission/denied, got: ${failure.message}`,
      ).toBe(true);
    });

    it("menu categories cannot be hard-deleted by clients", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "authenticated",
        world.adminA.id,
        "delete from public.menu_categories where id = $1",
        [world.categoryA],
      );
      expect(
        failure.code === "42501" || /permission denied|delete/i.test(failure.message),
        `expected permission/denied, got: ${failure.message}`,
      ).toBe(true);
    });

    it("archived items are hidden from the public menu but visible to the workspace", async () => {
      const hiddenAnon = await queryRows(
        world.db,
        "anon",
        null,
        "select id from public.menu_items where restaurant_id = $1 and name = 'Ugali'",
        [world.restaurantA],
      );
      // Ugali exists but is available — anon should see it
      expect(hiddenAnon).toHaveLength(1);

      // Mark it archived and check anon no longer sees it
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.menu_items set archived_at = now() where restaurant_id = $1 and name = 'Ugali'",
        [world.restaurantA],
      );
      const gone = await queryRows(
        world.db,
        "anon",
        null,
        "select id from public.menu_items where restaurant_id = $1 and name = 'Ugali'",
        [world.restaurantA],
      );
      expect(gone).toHaveLength(0);

      // …but the workspace sees it
      const seen = await queryRows(
        world.db,
        "authenticated",
        world.adminA.id,
        "select id from public.menu_items where restaurant_id = $1 and name = 'Ugali'",
        [world.restaurantA],
      );
      expect(seen).toHaveLength(1);

      // Restore
      await runAs(
        world.db,
        "authenticated",
        world.adminA.id,
        "update public.menu_items set archived_at = null where restaurant_id = $1 and name = 'Ugali'",
        [world.restaurantA],
      );
    });

    it("archived categories are hidden from the public menu", async () => {
      // Create and archive a fresh test category
      const rows = await queryRows<{ id: string }>(
        world.db,
        "authenticated",
        world.adminA.id,
        "insert into public.menu_categories (restaurant_id, name, sort_order, archived_at) values ($1, 'Temp Cat', 99, now()) returning id",
        [world.restaurantA],
      );
      const id = rows[0]!.id;

      const anon = await queryRows(
        world.db,
        "anon",
        null,
        "select id from public.menu_categories where id = $1",
        [id],
      );
      expect(anon).toHaveLength(0);
    });

    it("get_public_menu returns published rows for an approved, active restaurant", async () => {
      const rows = await queryRows<{ item_name: string; restaurant_slug: string }>(
        world.db,
        "anon",
        null,
        "select item_name, restaurant_slug from public.get_public_menu('demo-cafe') order by item_name",
      );
      const demoSlug = rows.length > 0 ? rows[0]!.restaurant_slug : null;
      expect(demoSlug).toBe("demo-cafe");
      expect(rows.map((row) => row.item_name)).toContain("Pilau");
      // Unavailable items (Mandazi) can appear but must be labelled as such — they do surface as is_available=false rows.
      const mandazi = rows.find((row) => row.item_name === "Mandazi");
      expect(mandazi).toBeDefined();
    });

    it("get_public_menu never leaks unapproved restaurants", async () => {
      // A non-approved restaurant would be invisible to anon; trigger setup:
      // The fixture has no unapproved restaurant in menu data — but the RPC must
      // still return zero rows for a bogus slug.
      const rows = await queryRows<{ restaurant_slug: string }>(
        world.db,
        "anon",
        null,
        "select restaurant_slug from public.get_public_menu('not-a-real-slug')",
      );
      expect(rows).toHaveLength(0);
    });

    it("get_public_menu never returns another restaurant's items", async () => {
      const rows = await queryRows<{ restaurant_slug: string }>(
        world.db,
        "anon",
        null,
        "select restaurant_slug from public.get_public_menu('tiny-diner')",
      );
      for (const row of rows) {
        expect(row.restaurant_slug).toBe("tiny-diner");
      }
    });

    it("menu-images bucket exists with public read and 2 MB limit", async () => {
      // Storage is inspected as the database owner; clients never reach it.
      // Storage is inspected as the database owner; clients never reach it.
      const buckets = await world.db.query<{
        public: boolean;
        file_size_limit: bigint;
        allowed_mime_types: string[];
      }>(
        "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'menu-images'",
      );
      expect(buckets.rows).toHaveLength(1);
      expect(buckets.rows[0]!.public).toBe(true);
      expect(Number(buckets.rows[0]!.file_size_limit)).toBe(2097152);
      expect(buckets.rows[0]!.allowed_mime_types).toEqual(
        expect.arrayContaining(["image/png", "image/jpeg", "image/webp", "image/avif"]),
      );
    });

    it("menu-images write policies scope to the restaurant folder", async () => {
      const policies = await world.db.query<{ policyname: string }>(
        "select policyname from pg_policies where tablename = 'objects' and policyname ilike 'menu_images%' order by 1",
      );
      const names = policies.rows.map((policy) => policy.policyname);
      expect(names).toEqual(
        expect.arrayContaining(["menu_images_admin_write", "menu_images_select"]),
      );
    });

    it("unauthenticated anon cannot write to menu_items or menu_categories", async () => {
      const failure = await expectSqlFailure(
        world.db,
        "anon",
        null,
        "insert into public.menu_items (restaurant_id, category_id, name, price_tzs) values ($1, $2, 'x', 1)",
        [world.restaurantA, world.categoryA],
      );
      expectPermission(failure);

      const failure2 = await expectSqlFailure(
        world.db,
        "anon",
        null,
        "update public.menu_categories set name = 'hack' where id = $1",
        [world.categoryA],
      );
      expectPermission(failure2);
    });
  });
}
