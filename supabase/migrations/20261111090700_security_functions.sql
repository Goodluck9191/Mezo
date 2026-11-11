-- =============================================================================
-- Mezo — 08. Security helper functions and integrity triggers
-- =============================================================================
-- Two distinct styles of function live here.
--
-- 1. RLS helpers (is_restaurant_member, has_restaurant_role, ...) are STABLE,
--    SECURITY DEFINER and set search_path = ''. They bypass RLS (the function
--    owner is the table owner), which is what prevents infinite policy
--    recursion on restaurant_members / restaurants. They expose only booleans.
--    Granted to the roles that actually need them.
--
-- 2. Mutation RPCs (request_table_session, approve/close session, application
--    review) are the ONLY supported write paths for table_sessions and
--    restaurant_applications. Clients cannot write to those tables directly.
--
-- Trigger functions use set search_path = '' and qualify every object.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 08.1 Privilege helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$$;

comment on function public.is_platform_admin() is
  'True when the caller is a platform administrator. Used by RLS policies.';

create or replace function public.is_restaurant_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = auth.uid()
      and m.is_active
  );
$$;

comment on function public.is_restaurant_member(uuid) is
  'True when the caller has an active membership row for the restaurant.';

create or replace function public.has_restaurant_role(
  p_restaurant_id uuid,
  p_roles public.restaurant_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = auth.uid()
      and m.is_active
      and m.role = any (p_roles)
  );
$$;

comment on function public.has_restaurant_role(uuid, public.restaurant_role[]) is
  'True when the caller holds one of the given active roles in the restaurant.';

-- Any two users who share at least one restaurant. Used to decide whether a
-- colleague's profile may be read.
create or replace function public.shares_restaurant_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_members mine
    join public.restaurant_members theirs
      on theirs.restaurant_id = mine.restaurant_id
    where mine.user_id = auth.uid()
      and mine.is_active
      and theirs.user_id = p_user_id
      and theirs.is_active
  );
$$;

comment on function public.shares_restaurant_with(uuid) is
  'True when the caller shares at least one active restaurant membership with the given user.';

-- Public storefront visibility: approved restaurant with active operations.
-- Bypasses RLS so menu policies can stay one line long.
create or replace function public.is_restaurant_public(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurants r
    where r.id = p_restaurant_id
      and r.application_status = 'approved'
      and r.operational_status = 'active'
  );
$$;

comment on function public.is_restaurant_public(uuid) is
  'True when the restaurant is approved and active. Used by public menu policies.';

-- Category must be active and in a publicly available restaurant.
create or replace function public.is_category_public(p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.menu_categories c
    join public.restaurants r
      on r.id = c.restaurant_id
    where c.id = p_category_id
      and c.is_active
      and r.application_status = 'approved'
      and r.operational_status = 'active'
  );
$$;

comment on function public.is_category_public(uuid) is
  'True when the category is active and its restaurant is publicly available.';

-- Order visibility for guests and staff.
create or replace function public.can_read_order(p_order_id uuid, p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.restaurant_id = p_restaurant_id
      and (
        exists (
          select 1
          from public.restaurant_members m
          where m.restaurant_id = p_restaurant_id
            and m.user_id = auth.uid()
            and m.is_active
        )
        or exists (
          select 1
          from public.guest_sessions g
          where g.id = o.guest_session_id
            and g.user_id = auth.uid()
        )
      )
  );
$$;

comment on function public.can_read_order(uuid, uuid) is
  'True when the caller is restaurant staff or owns the guest session of the order.';

-- Adding items / changing an order requires an open table session and either
-- staff membership or the owning guest.
create or replace function public.can_write_order(p_order_id uuid, p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    join public.table_sessions ts on ts.id = o.table_session_id
    where o.id = p_order_id
      and o.restaurant_id = p_restaurant_id
      and ts.status = 'active'
      and o.status not in ('served', 'cancelled')
      and (
        exists (
          select 1
          from public.guest_sessions g
          where g.id = o.guest_session_id
            and g.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.restaurant_members m
          where m.restaurant_id = p_restaurant_id
            and m.user_id = auth.uid()
            and m.is_active
            and m.role in ('restaurant_admin', 'waiter')
        )
      )
  );
$$;

comment on function public.can_write_order(uuid, uuid) is
  'True when the order is in an active table session, not finished, and the caller is staff or its guest.';

-- Placing a brand-new order requires the guest to own the session and the
-- table session to be active, and the restaurant to be publicly available.
create or replace function public.guest_can_order(
  p_restaurant_id uuid,
  p_guest_session_id uuid,
  p_table_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guest_sessions g
    join public.table_sessions ts
      on ts.id = g.table_session_id
      and ts.restaurant_id = g.restaurant_id
    join public.restaurants r
      on r.id = ts.restaurant_id
    where g.id = p_guest_session_id
      and g.user_id = auth.uid()
      and g.restaurant_id = p_restaurant_id
      and g.table_session_id = p_table_session_id
      and ts.status = 'active'
      and r.application_status = 'approved'
      and r.operational_status = 'active'
  );
$$;

comment on function public.guest_can_order(uuid, uuid, uuid) is
  'True when the caller is the guest, the table session is active, and the restaurant accepts orders.';

-- Assistance / bill requests are allowed while the session is pending or
-- active, but not after it is closed.
create or replace function public.guest_can_request(
  p_restaurant_id uuid,
  p_guest_session_id uuid,
  p_table_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guest_sessions g
    join public.table_sessions ts
      on ts.id = g.table_session_id
      and ts.restaurant_id = g.restaurant_id
    join public.restaurants r
      on r.id = ts.restaurant_id
    where g.id = p_guest_session_id
      and g.user_id = auth.uid()
      and g.restaurant_id = p_restaurant_id
      and g.table_session_id = p_table_session_id
      and ts.status in ('pending', 'active')
      and r.application_status = 'approved'
      and r.operational_status = 'active'
  );
$$;

comment on function public.guest_can_request(uuid, uuid, uuid) is
  'True when the caller is the guest in an open (pending or active) table session.';

-- Guest participation in a table session.
create or replace function public.has_guest_session(p_table_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guest_sessions g
    where g.table_session_id = p_table_session_id
      and g.user_id = auth.uid()
  );
$$;

comment on function public.has_guest_session(uuid) is
  'True when the caller participates in the given table session.';

create or replace function public.owns_guest_session(p_guest_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guest_sessions g
    where g.id = p_guest_session_id
      and g.user_id = auth.uid()
  );
$$;

comment on function public.owns_guest_session(uuid) is
  'True when the caller owns the given guest session.';

-- ---------------------------------------------------------------------------
-- 08.2 Auth bootstrap: create the profile when Supabase Auth creates a user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates a profile row for every new auth user. Trigger on auth.users.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 08.3 Table-session lifecycle RPCs
-- ---------------------------------------------------------------------------

-- Guest scan flow. Returns the (possibly pre-existing) open session for the
-- table and ensures the caller has a guest_session row in it.
create or replace function public.request_table_session(
  p_qr_token text,
  p_party_size integer default null
)
returns public.table_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_table public.restaurant_tables;
  v_restaurant public.restaurants;
  v_session public.table_sessions;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_party_size is not null and p_party_size not between 1 and 50 then
    raise exception 'party size must be between 1 and 50' using errcode = '22023';
  end if;

  select * into v_table
  from public.restaurant_tables t
  where t.qr_token = p_qr_token;

  if not found then
    -- Deliberately generic: do not reveal whether a code exists but is inactive.
    raise exception 'invalid table code' using errcode = 'P0002';
  end if;

  if not v_table.is_active then
    raise exception 'this table is not accepting orders' using errcode = '22023';
  end if;

  select * into v_restaurant
  from public.restaurants r
  where r.id = v_table.restaurant_id;

  if v_restaurant.application_status <> 'approved'
     or v_restaurant.operational_status <> 'active' then
    raise exception 'this restaurant is not accepting orders' using errcode = '22023';
  end if;

  -- One occupancy session per table at a time. If a session is already open,
  -- the new guest joins it instead of creating a duplicate.
  select * into v_session
  from public.table_sessions s
  where s.table_id = v_table.id
    and s.status in ('pending', 'active')
  order by s.requested_at asc
  limit 1;

  if not found then
    begin
      insert into public.table_sessions (restaurant_id, table_id, status, party_size)
      values (v_table.restaurant_id, v_table.id, 'pending', p_party_size)
      returning * into v_session;
    exception
      -- Lost a race with another guest: read the winner and join it.
      when unique_violation then
        select * into v_session
        from public.table_sessions s
        where s.table_id = v_table.id
          and s.status in ('pending', 'active')
        order by s.requested_at asc
        limit 1;
    end;
  end if;

  insert into public.guest_sessions (restaurant_id, table_session_id, user_id)
  values (v_table.restaurant_id, v_session.id, v_user)
  on conflict (table_session_id, user_id)
  do update set last_seen_at = pg_catalog.now();

  return v_session;
end;
$$;

comment on function public.request_table_session(text, integer) is
  'Guest entry point. Creates or joins the table occupancy session and records the caller as a guest.';

-- Staff approval. Only restaurant_admin or waiter may activate a session.
create or replace function public.approve_table_session(p_session_id uuid)
returns public.table_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.table_sessions;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_session
  from public.table_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if not public.has_restaurant_role(
    v_session.restaurant_id,
    array['restaurant_admin', 'waiter']::public.restaurant_role[]
  ) then
    raise exception 'only staff of this restaurant can approve a session'
      using errcode = '42501';
  end if;

  if v_session.status <> 'pending' then
    raise exception 'session is not pending approval' using errcode = '22000';
  end if;

  if not public.is_restaurant_public(v_session.restaurant_id) then
    raise exception 'restaurant is not active' using errcode = '22023';
  end if;

  update public.table_sessions
  set status = 'active',
      approved_at = pg_catalog.now(),
      approved_by = v_actor
  where id = v_session.id
  returning * into v_session;

  return v_session;
end;
$$;

comment on function public.approve_table_session(uuid) is
  'Waiter or restaurant admin: activate a pending occupancy session.';

-- Staff closure: table cleared, guests must scan again next seating.
create or replace function public.close_table_session(p_session_id uuid)
returns public.table_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.table_sessions;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_session
  from public.table_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if not public.has_restaurant_role(
    v_session.restaurant_id,
    array['restaurant_admin', 'waiter']::public.restaurant_role[]
  ) then
    raise exception 'only staff of this restaurant can close a session'
      using errcode = '42501';
  end if;

  if v_session.status = 'closed' then
    raise exception 'session is already closed' using errcode = '22000';
  end if;

  update public.table_sessions
  set status = 'closed',
      closed_at = pg_catalog.now(),
      closed_by = v_actor
  where id = v_session.id
  returning * into v_session;

  return v_session;
end;
$$;

comment on function public.close_table_session(uuid) is
  'Waiter or restaurant admin: close the occupancy session for a table.';

-- ---------------------------------------------------------------------------
-- 08.4 Restaurant onboarding
-- ---------------------------------------------------------------------------

-- A signed-in user applies to register a restaurant. Creates the (pending)
-- restaurant and a pending application atomically. The applicant becomes
-- restaurant_admin only when a platform admin approves.
create or replace function public.apply_for_restaurant(
  p_name text,
  p_slug text,
  p_description text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_address_line1 text default null,
  p_address_line2 text default null,
  p_city text default null,
  p_region text default null,
  p_message text default null
)
returns public.restaurant_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_restaurant_id uuid;
  v_application public.restaurant_applications;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.restaurant_applications a
    where a.applicant_user_id = v_user
      and a.status = 'pending'
  ) then
    raise exception 'you already have a pending application' using errcode = '23505';
  end if;

  insert into public.restaurants (
    name, slug, description, contact_email, contact_phone,
    address_line1, address_line2, city, region, created_by
  )
  values (
    p_name, p_slug, p_description, p_contact_email, p_contact_phone,
    p_address_line1, p_address_line2, p_city, p_region, v_user
  )
  returning id into v_restaurant_id;

  insert into public.restaurant_applications (
    restaurant_id, applicant_user_id, applicant_name, applicant_phone, message
  )
  values (
    v_restaurant_id,
    v_user,
    (select p.full_name from public.profiles p where p.id = v_user),
    p_contact_phone,
    p_message
  )
  returning * into v_application;

  return v_application;
end;
$$;

comment on function public.apply_for_restaurant(text, text, text, text, text, text, text, text, text, text) is
  'Authenticated user applies to register a restaurant. Result stays pending until platform review.';

-- Platform review. Approval activates the restaurant, snapshots the chosen
-- plan into restaurant_subscriptions, and makes the applicant the first
-- restaurant_admin. Rejection keeps the restaurant out of service.
create or replace function public.review_restaurant_application(
  p_application_id uuid,
  p_decision public.application_status,
  p_plan_id uuid default null,
  p_reason text default null
)
returns public.restaurant_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_application public.restaurant_applications;
begin
  -- No caller identity means no privileged operation. Administrative paths are
  -- always authorised via the caller's JWT, never via the fact that the
  -- function itself is SECURITY DEFINER.
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;

  if p_decision = 'rejected' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'a rejection reason is required' using errcode = '22004';
  end if;

  select * into v_application
  from public.restaurant_applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  if v_application.status <> 'pending' then
    raise exception 'application already reviewed' using errcode = '22000';
  end if;

  if p_decision = 'approved' then
    if p_plan_id is null then
      raise exception 'a subscription plan is required to approve an application'
        using errcode = '22004';
    end if;

    if not exists (
      select 1 from public.subscription_plans p
      where p.id = p_plan_id and p.is_active
    ) then
      raise exception 'subscription plan is missing or inactive' using errcode = '23503';
    end if;

    update public.restaurant_applications
    set status = 'approved',
        reviewed_by = v_actor,
        reviewed_at = pg_catalog.now(),
        rejection_reason = null
    where id = v_application.id
    returning * into v_application;

    update public.restaurants
    set application_status = 'approved',
        operational_status = 'active',
        approved_at = pg_catalog.now(),
        approved_by = v_actor
    where id = v_application.restaurant_id;

    insert into public.restaurant_subscriptions (
      restaurant_id, plan_id, status, starts_on, renews_on
    )
    values (
      v_application.restaurant_id,
      p_plan_id,
      'active',
      current_date,
      current_date + 30
    );

    -- The registrar becomes the first restaurant admin.
    insert into public.restaurant_members (restaurant_id, user_id, role, invited_by)
    values (
      v_application.restaurant_id,
      v_application.applicant_user_id,
      'restaurant_admin',
      v_actor
    )
    on conflict (restaurant_id, user_id)
    do update set role = 'restaurant_admin', is_active = true;
  else
    update public.restaurant_applications
    set status = 'rejected',
        reviewed_by = v_actor,
        reviewed_at = pg_catalog.now(),
        rejection_reason = p_reason
    where id = v_application.id
    returning * into v_application;

    update public.restaurants
    set application_status = 'rejected',
        operational_status = 'suspended'
    where id = v_application.restaurant_id;
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_actor,
    'platform_admin',
    v_application.restaurant_id,
    'restaurant_application.' || p_decision::text,
    'restaurant_application',
    v_application.id,
    jsonb_strip_nulls(jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')))
  );

  return v_application;
end;
$$;

comment on function public.review_restaurant_application(uuid, public.application_status, uuid, text) is
  'Platform admin only. Approve or reject a restaurant application.';

commit;
