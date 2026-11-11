-- =============================================================================
-- Mezo — 11. Privileges (grants and revokes)
-- =============================================================================
-- Supabase ships default privileges that grant ALL on public tables to anon
-- and authenticated. We revoke everything and grant only what each role needs.
-- RLS then narrows those grants further. Both layers are deliberate.
--
-- The service role is never a client role: it bypasses RLS and is used only
-- by server-only modules. It keeps full access.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Strip defaults for the client roles (current and future objects).
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all functions in schema public from anon;
revoke all on all functions in schema public from authenticated;
revoke all on all sequences in schema public from anon;
revoke all on all sequences in schema public from authenticated;

alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on functions from anon, authenticated, public;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

-- Functions created in public are executable by PUBLIC by default. Trigger
-- functions and internal helpers must never be client-callable.
revoke execute on all functions in schema public from public;

-- ---------------------------------------------------------------------------
-- 2. Service role keeps full access (server-only).
-- ---------------------------------------------------------------------------
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- 3. Anon: exactly the public catalogue, nothing else.
-- ---------------------------------------------------------------------------
grant select on public.subscription_plans to anon;
grant select on public.menu_categories to anon;
grant select on public.menu_items to anon;
grant select on public.public_restaurants to anon;

-- ---------------------------------------------------------------------------
-- 4. Authenticated, per table and column.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

grant select on public.platform_admins to authenticated;

grant select on public.restaurants to authenticated;
grant update (
  name, slug, description, logo_url, contact_email, contact_phone,
  address_line1, address_line2, city, region, country_code
) on public.restaurants to authenticated;

grant select, insert, delete on public.restaurant_members to authenticated;
grant update (role, is_active) on public.restaurant_members to authenticated;

grant select on public.restaurant_applications to authenticated;

grant select, insert, delete on public.restaurant_tables to authenticated;
grant update (name, qr_token, is_active) on public.restaurant_tables to authenticated;

grant select, insert, delete on public.menu_categories to authenticated;
grant update (name, description, sort_order, is_active) on public.menu_categories to authenticated;

grant select, insert, delete on public.menu_items to authenticated;
grant update (
  category_id, name, description, price_tzs, image_url, is_available, sort_order
) on public.menu_items to authenticated;

grant select on public.table_sessions to authenticated;

grant select on public.guest_sessions to authenticated;
grant update (display_name, last_seen_at) on public.guest_sessions to authenticated;

grant select, insert on public.orders to authenticated;
grant update (status, notes) on public.orders to authenticated;

grant select, insert on public.order_items to authenticated;

grant select on public.order_events to authenticated;

grant select, insert on public.waiter_requests to authenticated;
grant update (status, note) on public.waiter_requests to authenticated;

grant select on public.payments to authenticated;

grant select on public.payment_attempts to authenticated;

grant select on public.payment_webhook_events to authenticated;

grant select on public.subscription_plans to authenticated;

grant select on public.restaurant_subscriptions to authenticated;

grant select on public.subscription_payments to authenticated;

grant select on public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Function privileges.
-- ---------------------------------------------------------------------------
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_restaurant_member(uuid) to authenticated;
grant execute on function public.has_restaurant_role(uuid, public.restaurant_role[])
  to authenticated;
grant execute on function public.shares_restaurant_with(uuid) to authenticated;
grant execute on function public.can_read_order(uuid, uuid) to authenticated;
grant execute on function public.can_write_order(uuid, uuid) to authenticated;
grant execute on function public.guest_can_order(uuid, uuid, uuid) to authenticated;
grant execute on function public.guest_can_request(uuid, uuid, uuid) to authenticated;
grant execute on function public.has_guest_session(uuid) to authenticated;
grant execute on function public.owns_guest_session(uuid) to authenticated;

-- Used by anon menu policies.
grant execute on function public.is_restaurant_public(uuid) to anon, authenticated;
grant execute on function public.is_category_public(uuid) to anon, authenticated;

-- Mutation RPCs: authenticated may call them; authorization happens inside.
grant execute on function public.request_table_session(text, integer) to authenticated;
grant execute on function public.approve_table_session(uuid) to authenticated;
grant execute on function public.close_table_session(uuid) to authenticated;
grant execute on function public.apply_for_restaurant(text, text, text, text, text, text, text, text, text, text)
  to authenticated;
grant execute on function public.review_restaurant_application(uuid, public.application_status, uuid, text)
  to authenticated;

-- Intentionally not granted to clients: handle_new_user, set_updated_at,
-- sanitize_new_order, snapshot_order_item, protect_order_item_snapshot,
-- protect_restaurant_review_fields, snapshot_subscription_plan,
-- enforce_table_limit, enforce_order_status_transition, refresh_order_totals,
-- log_order_event, stamp_waiter_request, sync_restaurant_subscription_status.

commit;
