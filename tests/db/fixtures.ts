/**
 * Builds the standard test world:
 *
 *   Platform admin
 *   Restaurant A (approved, active): restaurant_admin adminA, waiter waiterA,
 *     kitchen kitchenA, tables A1/A2, category + items, active subscription
 *     on the Growth plan (20 tables).
 *   Restaurant B (approved, active): restaurant_admin adminB, waiter waiterB,
 *     table B1, item.
 *   Restaurant C (approved, active): Growth subscription replaced by Starter
 *     (5 tables) for the table-limit test.
 *   Guests guest1 and guest2 for the QR scan flow.
 *
 * Everything is created as the database superuser (PGlite `postgres`), never
 * through a client role, so fixture setup is unconstrained.
 */
import {
  createStagingDb,
  createTestDatabase,
  createUser,
  makeIdentity,
  type Identity,
  type TestDb,
} from "./harness";

export interface World {
  db: TestDb;
  platformAdmin: Identity;
  applicant: Identity;
  rejectee: Identity;
  adminA: Identity;
  waiterA: Identity;
  kitchenA: Identity;
  adminB: Identity;
  waiterB: Identity;
  guest1: Identity;
  guest2: Identity;
  restaurantA: string;
  restaurantB: string;
  restaurantC: string;
  tableA1: string;
  tableA2: string;
  tableB1: string;
  tableC1: string;
  categoryA: string;
  categoryB: string;
  itemA: string;
  itemB: string;
  qrA1: string;
  qrA2: string;
  growthPlanId: string;
  starterPlanId: string;
}

async function insertRestaurant(
  db: TestDb,
  id: string,
  name: string,
  slug: string,
  createdBy: string,
) {
  await db.query(
    `insert into public.restaurants (
       id, name, slug, application_status, operational_status,
       subscription_status, created_by, approved_at, approved_by
     ) values (
       $1, $2, $3, 'approved', 'active', 'active', $4, now(), $4
     )`,
    [id, name, slug, createdBy],
  );
}

const FIXTURE_SLUGS = ["demo-cafe", "other-bistro", "tiny-diner"];
const STAFF_APPLICATION_SLUGS = ["coastal-grill", "reject-grill"];

/**
 * Staging is a hosted, dedicated project: fixtures persist so the run is
 * "live" verification, and every re-run must therefore reset the fixture
 * universe first, otherwise duplicate identifiers abort the build. Never
 * touches anything outside the fixture slugs / example.test emails.
 */
async function resetStagingFixtures(db: TestDb) {
  const fixtureUserIds = (
    await db.query<{ id: string }>("select id from auth.users where email like '%@example.test'")
  ).rows.map((r) => r.id);

  if (fixtureUserIds.length > 0) {
    await db.query("delete from public.audit_logs where actor_user_id = any($1::uuid[])", [
      fixtureUserIds,
    ]);
  }
  await db.query("delete from public.restaurants where slug = any($1::text[])", [FIXTURE_SLUGS]);
  await db.query("delete from public.restaurants where slug = any($1::text[])", [
    STAFF_APPLICATION_SLUGS,
  ]);
  await db.query("delete from auth.users where email like '%@example.test'", []);
}

export type DbTarget = "pglite" | "staging";

export async function buildWorld(target: DbTarget = "pglite"): Promise<World> {
  const db = target === "staging" ? await createStagingDb() : await createTestDatabase();

  if (target === "staging") {
    await resetStagingFixtures(db);
  }

  const platformAdmin = makeIdentity("platform-admin");
  const applicant = makeIdentity("applicant");
  const rejectee = makeIdentity("rejectee");
  const adminA = makeIdentity("admin-a");
  const waiterA = makeIdentity("waiter-a");
  const kitchenA = makeIdentity("kitchen-a");
  const adminB = makeIdentity("admin-b");
  const waiterB = makeIdentity("waiter-b");
  const guest1 = makeIdentity("guest-1");
  const guest2 = makeIdentity("guest-2");

  const allUsers = [
    platformAdmin,
    applicant,
    rejectee,
    adminA,
    waiterA,
    kitchenA,
    adminB,
    waiterB,
    guest1,
    guest2,
  ];
  for (const identity of allUsers) {
    await createUser(db, identity, identity.email.split("@")[0]);
  }

  await db.query("insert into public.platform_admins (user_id) values ($1)", [platformAdmin.id]);

  const restaurantA = crypto.randomUUID();
  const restaurantB = crypto.randomUUID();
  const restaurantC = crypto.randomUUID();

  await insertRestaurant(db, restaurantA, "Demo Cafe", "demo-cafe", adminA.id);
  await insertRestaurant(db, restaurantB, "Other Bistro", "other-bistro", adminB.id);
  await insertRestaurant(db, restaurantC, "Tiny Diner", "tiny-diner", adminA.id);

  const plans = await db.query<{ id: string; code: string }>(
    "select id, code from public.subscription_plans where code in ('growth_monthly', 'starter_monthly')",
  );
  const growthPlanId = plans.rows.find((p) => p.code === "growth_monthly")!.id;
  const starterPlanId = plans.rows.find((p) => p.code === "starter_monthly")!.id;

  await db.query(
    `insert into public.restaurant_subscriptions (restaurant_id, plan_id, status, starts_on, renews_on)
     values ($1, $2, 'active', current_date, current_date + 30),
            ($3, $2, 'active', current_date, current_date + 30),
            ($4, $5, 'active', current_date, current_date + 30)`,
    [restaurantA, growthPlanId, restaurantB, restaurantC, starterPlanId],
  );

  const members: Array<[string, string, string]> = [
    [restaurantA, adminA.id, "restaurant_admin"],
    [restaurantA, waiterA.id, "waiter"],
    [restaurantA, kitchenA.id, "kitchen"],
    [restaurantB, adminB.id, "restaurant_admin"],
    [restaurantB, waiterB.id, "waiter"],
  ];
  for (const [restaurantId, userId, role] of members) {
    await db.query(
      "insert into public.restaurant_members (restaurant_id, user_id, role) values ($1, $2, $3)",
      [restaurantId, userId, role],
    );
  }

  const tableA1 = crypto.randomUUID();
  const tableA2 = crypto.randomUUID();
  const tableB1 = crypto.randomUUID();
  const tableC1 = crypto.randomUUID();

  await db.query(
    `insert into public.restaurant_tables (id, restaurant_id, name)
     values ($1, $2, 'Table 1'), ($3, $4, 'Table 2'), ($5, $6, 'Table 1'), ($7, $8, 'T1')`,
    [tableA1, restaurantA, tableA2, restaurantA, tableB1, restaurantB, tableC1, restaurantC],
  );

  const categoryA = crypto.randomUUID();
  const categoryB = crypto.randomUUID();
  const categoryBHidden = crypto.randomUUID();
  await db.query(
    `insert into public.menu_categories (id, restaurant_id, name, sort_order)
     values ($1, $2, 'Mains', 0), ($3, $4, 'Mains', 0)`,
    [categoryA, restaurantA, categoryB, restaurantB],
  );
  await db.query(
    `insert into public.menu_categories (id, restaurant_id, name, sort_order, is_active)
     values ($1, $2, 'Hidden', 1, false)`,
    [categoryBHidden, restaurantB],
  );

  const itemA = crypto.randomUUID();
  const itemB = crypto.randomUUID();
  await db.query(
    `insert into public.menu_items (id, restaurant_id, category_id, name, price_tzs, sort_order)
     values ($1, $2, $3, 'Pilau', 12000, 0), ($4, $5, $6, 'Other Pilau', 9000, 0)`,
    [itemA, restaurantA, categoryA, itemB, restaurantB, categoryB],
  );

  const tokens = await db.query<{ id: string; qr_token: string }>(
    "select id, qr_token from public.restaurant_tables where id in ($1, $2)",
    [tableA1, tableA2],
  );
  const qrA1 = tokens.rows.find((r) => r.id === tableA1)!.qr_token;
  const qrA2 = tokens.rows.find((r) => r.id === tableA2)!.qr_token;

  return {
    db,
    platformAdmin,
    applicant,
    rejectee,
    adminA,
    waiterA,
    kitchenA,
    adminB,
    waiterB,
    guest1,
    guest2,
    restaurantA,
    restaurantB,
    restaurantC,
    tableA1,
    tableA2,
    tableB1,
    tableC1,
    categoryA,
    categoryB,
    itemA,
    itemB,
    qrA1,
    qrA2,
    growthPlanId,
    starterPlanId,
  };
}
