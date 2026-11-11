-- =============================================================================
-- Mezo — 09. Integrity triggers
-- =============================================================================
-- Triggers enforce integrity only. They never contain product workflows that
-- belong in a service layer. Every function sets search_path = ''.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 09.1 updated_at on mutable tables
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.restaurant_members
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.restaurant_applications
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.restaurant_tables
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.menu_categories
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.table_sessions
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.order_items
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.waiter_requests
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.payment_attempts
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.payment_webhook_events
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.subscription_plans
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.restaurant_subscriptions
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.subscription_payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 09.2 Protect platform-reviewed lifecycle fields
-- A restaurant_admin may edit menu, tables and contact details, but never the
-- application/approval/suspension state of the restaurant. Platform admins and
-- the service role (or the postgres owner inside SECURITY DEFINER RPCs) may.
-- ---------------------------------------------------------------------------

create or replace function public.protect_restaurant_review_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role') then
    return new;
  end if;

  if new.application_status is distinct from old.application_status
     or new.operational_status is distinct from old.operational_status
     or new.subscription_status is distinct from old.subscription_status
     or new.created_by is distinct from old.created_by
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by then
    if not public.is_platform_admin() then
      raise exception 'only platform administrators can change review or lifecycle fields'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger restaurants_protect_review_fields
  before update on public.restaurants
  for each row execute function public.protect_restaurant_review_fields();

comment on function public.protect_restaurant_review_fields() is
  'Blocks non-platform-admin writes to application_status, operational_status, subscription_status and approval metadata.';

-- ---------------------------------------------------------------------------
-- 09.3 Snapshot the plan limits onto the restaurant subscription
-- ---------------------------------------------------------------------------

create or replace function public.snapshot_subscription_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer;
begin
  select p.table_limit into v_limit
  from public.subscription_plans p
  where p.id = new.plan_id
    and p.is_active;

  if v_limit is null then
    raise exception 'subscription plan is missing or inactive' using errcode = '23503';
  end if;

  new.table_limit := v_limit;
  return new;
end;
$$;

create trigger restaurant_subscriptions_snapshot_plan
  before insert or update of plan_id, table_limit on public.restaurant_subscriptions
  for each row execute function public.snapshot_subscription_plan();

comment on function public.snapshot_subscription_plan() is
  'Forces restaurant_subscriptions.table_limit to the plan value; clients cannot raise their own limit.';

-- Keep restaurants.subscription_status in sync with the current subscription.
create or replace function public.sync_restaurant_subscription_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.restaurants r
  set subscription_status = new.status
  where r.id = new.restaurant_id;

  return null;
end;
$$;

create trigger restaurant_subscriptions_sync_status
  after insert or update of status on public.restaurant_subscriptions
  for each row execute function public.sync_restaurant_subscription_status();

-- ---------------------------------------------------------------------------
-- 09.4 Enforce the subscription table limit
-- Runs on insert only. Deactivating a table (is_active = false) is always
-- allowed; reducing a plan below the existing table count is deliberately not
-- blocked, the UI simply prevents new tables.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_table_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select s.table_limit into v_limit
  from public.restaurant_subscriptions s
  where s.restaurant_id = new.restaurant_id
    and s.status in ('pending', 'active', 'past_due')
  order by s.created_at desc
  limit 1;

  if v_limit is null then
    raise exception 'restaurant has no current subscription' using errcode = '23514';
  end if;

  select count(*) into v_count
  from public.restaurant_tables t
  where t.restaurant_id = new.restaurant_id;

  if v_count >= v_limit then
    raise exception 'table limit reached (% tables for this plan)', v_limit
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger restaurant_tables_enforce_limit
  before insert on public.restaurant_tables
  for each row execute function public.enforce_table_limit();

comment on function public.enforce_table_limit() is
  'Rejects inserting a table once the restaurant has used its plan table_limit.';

-- ---------------------------------------------------------------------------
-- 09.5 Order item snapshotting
-- Name and price come from menu_items, never from the client.
-- ---------------------------------------------------------------------------

create or replace function public.snapshot_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.menu_items;
begin
  if new.menu_item_id is null then
    raise exception 'menu_item_id is required' using errcode = '23502';
  end if;

  select * into v_item
  from public.menu_items mi
  where mi.id = new.menu_item_id;

  if not found then
    raise exception 'menu item not found' using errcode = 'P0002';
  end if;

  if v_item.restaurant_id <> new.restaurant_id then
    raise exception 'menu item does not belong to the same restaurant'
      using errcode = '42501';
  end if;

  if not v_item.is_available then
    raise exception 'menu item is not available' using errcode = '22023';
  end if;

  new.name_snapshot := v_item.name;
  new.unit_price_tzs := v_item.price_tzs;
  new.options := coalesce(new.options, '[]'::jsonb);
  return new;
end;
$$;

create trigger order_items_snapshot
  before insert on public.order_items
  for each row execute function public.snapshot_order_item();

-- Quantities and prices are immutable once written. The only legitimate
-- change is a note; the service role may fix data.
create or replace function public.protect_order_item_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role') then
    return new;
  end if;

  if new.name_snapshot is distinct from old.name_snapshot
     or new.unit_price_tzs is distinct from old.unit_price_tzs
     or new.menu_item_id is distinct from old.menu_item_id
     or new.order_id is distinct from old.order_id
     or new.restaurant_id is distinct from old.restaurant_id
     or new.quantity is distinct from old.quantity
     or new.subtotal_tzs is distinct from old.subtotal_tzs then
    raise exception 'order item snapshot fields are immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger order_items_protect_snapshot
  before update on public.order_items
  for each row execute function public.protect_order_item_snapshot();

comment on function public.snapshot_order_item() is
  'Copies name and price from menu_items at insert time; the client cannot set them.';

-- ---------------------------------------------------------------------------
-- 09.6 Order totals
-- Orders are recomputed from order_items rather than from the menu.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_order_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
  v_restaurant_id uuid := coalesce(new.restaurant_id, old.restaurant_id);
  v_subtotal bigint;
begin
  select coalesce(sum(oi.subtotal_tzs), 0) into v_subtotal
  from public.order_items oi
  where oi.order_id = v_order_id;

  update public.orders o
  set subtotal_tzs = v_subtotal,
      total_tzs = v_subtotal
  where o.id = v_order_id
    and o.restaurant_id = v_restaurant_id;

  return null;
end;
$$;

create trigger order_items_refresh_totals
  after insert or update or delete on public.order_items
  for each row execute function public.refresh_order_totals();

-- ---------------------------------------------------------------------------
-- 09.7 Sanitize new orders
-- Clients cannot choose status, totals, placed_at or placed_by.
-- ---------------------------------------------------------------------------

create or replace function public.sanitize_new_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status := 'placed';
  new.subtotal_tzs := 0;
  new.total_tzs := 0;
  new.placed_at := pg_catalog.now();
  new.placed_by := auth.uid();
  return new;
end;
$$;

create trigger orders_sanitize_new
  before insert on public.orders
  for each row execute function public.sanitize_new_order();

-- ---------------------------------------------------------------------------
-- 09.8 Order status state machine
-- This is an integrity constraint, not a business workflow.
--   placed -> accepted -> preparing -> ready -> served
--   any step may be cancelled, except served and cancelled.
-- Kitchen staff cannot cancel and cannot serve; waiters and admins can do both.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_allowed boolean;
  v_role public.restaurant_role;
begin
  if new.status = old.status then
    return new;
  end if;

  if current_user in ('postgres', 'service_role') then
    return new;
  end if;

  v_allowed := case old.status
    when 'placed' then new.status in ('accepted', 'cancelled')
    when 'accepted' then new.status in ('preparing', 'cancelled')
    when 'preparing' then new.status in ('ready', 'cancelled')
    when 'ready' then new.status in ('served', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid order status transition: % -> %', old.status, new.status
      using errcode = '22023';
  end if;

  select m.role into v_role
  from public.restaurant_members m
  where m.restaurant_id = new.restaurant_id
    and m.user_id = auth.uid()
    and m.is_active;

  if v_role is null then
    raise exception 'not a staff member of this restaurant' using errcode = '42501';
  end if;

  if v_role = 'kitchen' and new.status = 'cancelled' then
    raise exception 'kitchen staff cannot cancel orders' using errcode = '42501';
  end if;

  if v_role = 'kitchen' and old.status = 'ready' then
    raise exception 'kitchen staff cannot serve orders' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger orders_enforce_status_transition
  before update of status on public.orders
  for each row execute function public.enforce_order_status_transition();

comment on function public.enforce_order_status_transition() is
  'Validates the order status state machine and the per-role restrictions.';

-- ---------------------------------------------------------------------------
-- 09.9 Append-only order events (written by trigger, never by clients)
-- ---------------------------------------------------------------------------

create or replace function public.log_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (
      restaurant_id, order_id, event_type, to_status, actor_user_id
    )
    values (
      new.restaurant_id, new.id, 'created', new.status, new.placed_by
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.order_events (
      restaurant_id, order_id, event_type, from_status, to_status, actor_user_id
    )
    values (
      new.restaurant_id, new.id, 'status_changed', old.status, new.status, auth.uid()
    );
  end if;

  return new;
end;
$$;

create trigger orders_log_event_after_insert
  after insert on public.orders
  for each row execute function public.log_order_event();

create trigger orders_log_event_after_update
  after update of status on public.orders
  for each row execute function public.log_order_event();

comment on function public.log_order_event() is
  'Writes the created and status_changed events. Clients cannot write order_events.';

-- ---------------------------------------------------------------------------
-- 09.10 Waiter request receipt stamping
-- ---------------------------------------------------------------------------

create or replace function public.stamp_waiter_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'acknowledged' and old.status = 'open' then
    new.acknowledged_by := auth.uid();
    new.acknowledged_at := pg_catalog.now();
    new.resolved_by := null;
    new.resolved_at := null;
  elsif new.status = 'resolved' and old.status in ('open', 'acknowledged') then
    new.resolved_by := auth.uid();
    new.resolved_at := pg_catalog.now();
    if old.status = 'open' then
      new.acknowledged_by := coalesce(new.acknowledged_by, auth.uid());
      new.acknowledged_at := coalesce(new.acknowledged_at, pg_catalog.now());
    end if;
  elsif new.status = 'open' and old.status <> 'open' then
    new.acknowledged_by := null;
    new.acknowledged_at := null;
    new.resolved_by := null;
    new.resolved_at := null;
  end if;

  return new;
end;
$$;

create trigger waiter_requests_stamp
  before update on public.waiter_requests
  for each row execute function public.stamp_waiter_request();

commit;
