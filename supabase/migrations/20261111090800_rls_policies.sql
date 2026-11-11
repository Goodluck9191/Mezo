-- =============================================================================
-- Mezo — 10. Row Level Security
-- =============================================================================
-- Design rules
-- -------------
-- 1. Policies never reference a user-supplied restaurant_id blindly. They call
--    SECURITY DEFINER helpers (owned by the table owner) so a policy on
--    restaurant_tables never needs to re-read restaurant_members under a lock.
-- 2. No policy causes recursion: helpers bypass RLS, so a row's own table is
--    never re-evaluated.
-- 3. The service role is not a client role; it bypasses RLS and is never
--    granted here.
-- 4. Anon gets exactly one read surface: the public restaurant/menu catalogue
--    (public_restaurants view, menu_* tables, active plans).
-- 5. Guests see only their own participation and their restaurant's menu.
-- 6. Platform admins see platform-wide data, never tenant operations.
-- =============================================================================

begin;

-- Enable RLS on every table in scope.
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.restaurant_applications enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.table_sessions enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.waiter_requests enable row level security;
alter table public.payments enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.restaurant_subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: the user themselves, colleagues in a shared restaurant, or a
-- platform admin. Never publicly readable.
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_platform_admin()
    or public.shares_restaurant_with(id)
  );

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- No delete: profile rows are removed by the auth trigger cascade.

-- ---------------------------------------------------------------------------
-- platform_admins: platform admins can read the admin list. No client writes.
-- ---------------------------------------------------------------------------
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- restaurants: staff of the restaurant, the applicant, platform admins. No
-- public rows: the public menu surface lives in the public_restaurants view,
-- and the restaurant-facing contact details are never exposed cross-tenant.
-- ---------------------------------------------------------------------------
create policy restaurants_select_staff on public.restaurants
  for select to authenticated
  using (public.is_restaurant_member(id));

create policy restaurants_select_applicant on public.restaurants
  for select to authenticated
  using (created_by = auth.uid());

create policy restaurants_select_platform_admin on public.restaurants
  for select to authenticated
  using (public.is_platform_admin());

create policy restaurants_update_admin on public.restaurants
  for update to authenticated
  using (public.has_restaurant_role(id, array['restaurant_admin']::public.restaurant_role[]))
  with check (public.has_restaurant_role(id, array['restaurant_admin']::public.restaurant_role[]));

create policy restaurants_update_platform_admin on public.restaurants
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
-- Insert only via public.apply_for_restaurant(); review fields are guarded by
-- trigger 09.2. No delete policy.

-- ---------------------------------------------------------------------------
-- Public catalogue view: safe restaurant fields only. Created with
-- security_invoker = false so the owner (postgres) supplies the rows, while
-- the underlying table keeps no anon policy at all.
-- ---------------------------------------------------------------------------
create or replace view public.public_restaurants
with (security_invoker = false) as
select
  r.id,
  r.name,
  r.slug,
  r.description,
  r.logo_url,
  r.contact_phone,
  r.address_line1,
  r.address_line2,
  r.city,
  r.region,
  r.country_code
from public.restaurants r
where r.application_status = 'approved'
  and r.operational_status = 'active';

comment on view public.public_restaurants is
  'Public storefront directory. Safe fields only; sourced by the customer menu flow.';

-- ---------------------------------------------------------------------------
-- restaurant_members
-- ---------------------------------------------------------------------------
create policy restaurant_members_select_self on public.restaurant_members
  for select to authenticated
  using (user_id = auth.uid());

create policy restaurant_members_select_staff on public.restaurant_members
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy restaurant_members_select_platform_admin on public.restaurant_members
  for select to authenticated
  using (public.is_platform_admin());

create policy restaurant_members_insert_admin on public.restaurant_members
  for insert to authenticated
  with check (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  );

create policy restaurant_members_update_admin on public.restaurant_members
  for update to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  )
  with check (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  );

create policy restaurant_members_delete_admin on public.restaurant_members
  for delete to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  );
-- restaurant_id/user_id are immutable (column-level grants, see migration 11).

-- ---------------------------------------------------------------------------
-- restaurant_applications: owner-applicant or platform admin, nothing else.
-- Insert/update happen only inside SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
create policy restaurant_applications_select_applicant on public.restaurant_applications
  for select to authenticated
  using (applicant_user_id = auth.uid());

create policy restaurant_applications_select_platform_admin on public.restaurant_applications
  for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- restaurant_tables: QR tokens are bearer secrets, staff only, admin writes.
-- ---------------------------------------------------------------------------
create policy restaurant_tables_select_staff on public.restaurant_tables
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy restaurant_tables_write_admin on public.restaurant_tables
  for all to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  )
  with check (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  );

-- ---------------------------------------------------------------------------
-- menu_categories: public read when active and the restaurant is live; staff
-- read everything; restaurant_admin writes.
-- ---------------------------------------------------------------------------
create policy menu_categories_public_select on public.menu_categories
  for select to anon, authenticated
  using (is_active and public.is_restaurant_public(restaurant_id));

create policy menu_categories_staff_select on public.menu_categories
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy menu_categories_admin_write on public.menu_categories
  for all to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  )
  with check (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  );

-- ---------------------------------------------------------------------------
-- menu_items: same shape. Availability and the parent category govern public
-- visibility.
-- ---------------------------------------------------------------------------
create policy menu_items_public_select on public.menu_items
  for select to anon, authenticated
  using (is_available and public.is_category_public(category_id));

create policy menu_items_staff_select on public.menu_items
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy menu_items_admin_write on public.menu_items
  for all to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  )
  with check (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  );

-- ---------------------------------------------------------------------------
-- table_sessions: staff of the restaurant, or guests who participate. Writes
-- only via request_table_session / approve_table_session / close_table_session.
-- ---------------------------------------------------------------------------
create policy table_sessions_select_staff on public.table_sessions
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy table_sessions_select_guest on public.table_sessions
  for select to authenticated
  using (public.has_guest_session(id));

-- ---------------------------------------------------------------------------
-- guest_sessions: own rows; waiters and admins see their table's guests.
-- Guests may update only display_name / last_seen_at (column grants).
-- ---------------------------------------------------------------------------
create policy guest_sessions_select_own on public.guest_sessions
  for select to authenticated
  using (user_id = auth.uid());

create policy guest_sessions_select_staff on public.guest_sessions
  for select to authenticated
  using (
    public.has_restaurant_role(
      restaurant_id,
      array['restaurant_admin', 'waiter']::public.restaurant_role[]
    )
  );

create policy guest_sessions_update_own on public.guest_sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- orders: staff read; guest reads their own guest session's orders. Guest
-- insert only when the table session is active. Staff insert for their
-- restaurant in an active session. Updates are column-restricted (status,
-- notes) and validated by trigger 09.8. No deletes.
-- ---------------------------------------------------------------------------
create policy orders_select_staff on public.orders
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy orders_select_guest on public.orders
  for select to authenticated
  using (public.owns_guest_session(guest_session_id));

create policy orders_insert_guest on public.orders
  for insert to authenticated
  with check (
    public.guest_can_order(restaurant_id, guest_session_id, table_session_id)
  );

create policy orders_insert_staff on public.orders
  for insert to authenticated
  with check (
    public.has_restaurant_role(
      restaurant_id,
      array['restaurant_admin', 'waiter']::public.restaurant_role[]
    )
    and exists (
      select 1
      from public.table_sessions ts
      where ts.id = orders.table_session_id
        and ts.restaurant_id = orders.restaurant_id
        and ts.status = 'active'
    )
  );

create policy orders_update_staff on public.orders
  for update to authenticated
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

-- ---------------------------------------------------------------------------
-- order_items: same visibility as the order; guest insert requires an open
-- session and ownership; no client updates or deletes.
-- ---------------------------------------------------------------------------
create policy order_items_select_staff on public.order_items
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy order_items_select_guest on public.order_items
  for select to authenticated
  using (public.can_read_order(order_id, restaurant_id));

create policy order_items_insert_guest on public.order_items
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.restaurant_id = order_items.restaurant_id
        and public.owns_guest_session(o.guest_session_id)
    )
    and public.can_write_order(order_id, restaurant_id)
  );

create policy order_items_insert_staff on public.order_items
  for insert to authenticated
  with check (
    public.has_restaurant_role(
      restaurant_id,
      array['restaurant_admin', 'waiter']::public.restaurant_role[]
    )
    and public.can_write_order(order_id, restaurant_id)
  );

-- ---------------------------------------------------------------------------
-- order_events: append-only via triggers; readers see what they can read on
-- orders. No client writes.
-- ---------------------------------------------------------------------------
create policy order_events_select_staff on public.order_events
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy order_events_select_guest on public.order_events
  for select to authenticated
  using (public.can_read_order(order_id, restaurant_id));

-- ---------------------------------------------------------------------------
-- waiter_requests: kitchen does not need them. Guests create and see their
-- own; waiters/admins see and move them.
-- ---------------------------------------------------------------------------
create policy waiter_requests_select_guest on public.waiter_requests
  for select to authenticated
  using (public.owns_guest_session(guest_session_id));

create policy waiter_requests_select_staff on public.waiter_requests
  for select to authenticated
  using (
    public.has_restaurant_role(
      restaurant_id,
      array['restaurant_admin', 'waiter']::public.restaurant_role[]
    )
  );

create policy waiter_requests_insert_guest on public.waiter_requests
  for insert to authenticated
  with check (
    public.guest_can_request(restaurant_id, guest_session_id, table_session_id)
  );

create policy waiter_requests_insert_staff on public.waiter_requests
  for insert to authenticated
  with check (
    public.has_restaurant_role(
      restaurant_id,
      array['restaurant_admin', 'waiter']::public.restaurant_role[]
    )
  );

create policy waiter_requests_update_staff on public.waiter_requests
  for update to authenticated
  using (
    public.has_restaurant_role(
      restaurant_id,
      array['restaurant_admin', 'waiter']::public.restaurant_role[]
    )
  )
  with check (
    public.has_restaurant_role(
      restaurant_id,
      array['restaurant_admin', 'waiter']::public.restaurant_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- payments: staff for the bill; guests see their own table session's payment
-- rows once a payment exists. No client inserts or updates ever: the server
-- creates/updates these with the service role after webhook verification.
-- ---------------------------------------------------------------------------
create policy payments_select_staff on public.payments
  for select to authenticated
  using (
    public.has_restaurant_role(
      restaurant_id,
      array['restaurant_admin', 'waiter']::public.restaurant_role[]
    )
  );

create policy payments_select_guest on public.payments
  for select to authenticated
  using (public.has_guest_session(table_session_id));

-- ---------------------------------------------------------------------------
-- payment_attempts: restaurant admin reads for support; platform admin reads.
-- ---------------------------------------------------------------------------
create policy payment_attempts_select_admin on public.payment_attempts
  for select to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  );

create policy payment_attempts_select_platform_admin on public.payment_attempts
  for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- payment_webhook_events: raw provider payloads (may contain PII). Only
-- platform admins may read them.
-- ---------------------------------------------------------------------------
create policy payment_webhook_events_select_platform_admin on public.payment_webhook_events
  for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- subscription_plans: catalogue is public when active; platform admin reads
-- everything.
-- ---------------------------------------------------------------------------
create policy subscription_plans_public_select on public.subscription_plans
  for select to anon, authenticated
  using (is_active);

create policy subscription_plans_platform_admin_select on public.subscription_plans
  for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- restaurant_subscriptions: the restaurant's own admin reads; platform admin
-- reads all. Writes only via SECURITY DEFINER RPCs or the service role.
-- ---------------------------------------------------------------------------
create policy restaurant_subscriptions_select_admin on public.restaurant_subscriptions
  for select to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  );

create policy restaurant_subscriptions_select_platform_admin on public.restaurant_subscriptions
  for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- subscription_payments: restaurant admin and platform admin read; no client
-- writes.
-- ---------------------------------------------------------------------------
create policy subscription_payments_select_admin on public.subscription_payments
  for select to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['restaurant_admin']::public.restaurant_role[])
  );

create policy subscription_payments_select_platform_admin on public.subscription_payments
  for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- audit_logs: platform admins only. Deliberately no other role can read, and
-- no client role can write.
-- ---------------------------------------------------------------------------
create policy audit_logs_select_platform_admin on public.audit_logs
  for select to authenticated
  using (public.is_platform_admin());

commit;
