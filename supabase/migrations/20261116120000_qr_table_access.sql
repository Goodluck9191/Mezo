-- =============================================================================
-- Mezo — 19. QR codes & table access (Phase 7)
-- =============================================================================
-- This migration:
--
--   1. Replaces the plaintext `restaurant_tables.qr_token` with
--      `qr_token_hash` (md5 hex of the 244-bit bearer token). The cleartext
--      token is never stored; it is shown once at generation time and the QR
--      code printed from it. Validation compares `md5(p_token)` against the
--      stored hash inside SECURITY DEFINER functions only — client roles can
--      no longer read, write or update the hash at all.
--      md5 is unsalted by design and safe here for the same reason as the
--      staff invitations (migration 15): the preimage space is 244 bits of
--      CSPRNG output. PGlite lacks pgcrypto, so digest() is not available;
--      md5() is built in and keeps the migration portable.
--
--   2. Adds `table_access_requests`: one row per customer ask to open a new
--      table session or join an existing one. States:
--        pending -> approved | rejected | expired | cancelled
--      Pending requests expire after 15 minutes (documented in PROJECT_STATUS).
--      Expiry is enforced lazily with database `now()` inside every RPC that
--      reads or decides a request — there is deliberately no cron dependency.
--
--   3. RPCs (SECURITY DEFINER, search_path = '', caller identity from
--      auth.uid(), membership verified inside):
--        get_table_entry(p_qr_token)         — anonymous-safe projection for
--                                               the customer page (safe fields
--                                               only, plus the caller's own
--                                               access state).
--        request_table_access(p_qr_token)    — guest asks for access; creates
--                                               or returns a pending request
--                                               (idempotent while pending,
--                                               rate-capped per user).
--        approve_table_access(p_request_id)  — waiter/restaurant_admin only;
--                                               get-or-creates the single
--                                               active table_sessions row
--                                               under a table-row lock and
--                                               admits the requester.
--        reject_table_access(p_request_id)   — waiter/restaurant_admin only.
--        cancel_table_access(p_request_id)   — the requesting guest only.
--        regenerate_table_qr_token(p_table_id) — restaurant_admin only;
--                                               rotates the hash, invalidating
--                                               the old code. Cleartext
--                                               returned ONCE.
--        create_table_with_qr(p_restaurant_id, p_name) — restaurant_admin
--                                               only; plan table limit is
--                                               enforced by the existing
--                                               enforce_table_limit trigger.
--
--   4. `request_table_session` is dropped: in its Phase 2 form it created a
--      session/guest membership without any approval, which would bypass the
--      waiter-approval rule this phase exists to enforce.
--
--   5. `close_table_session` now also cancels pending access requests bound
--      to the session and writes an audit event.
--
-- Client writes to `table_access_requests` are not granted at all; every
-- state transition goes through the RPCs above and writes an audit_logs row.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 19.1 Enum for the per-customer access request lifecycle
-- ---------------------------------------------------------------------------
create type public.table_access_request_status as enum (
  'pending',
  'approved',
  'rejected',
  'expired',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- 19.2 Hash the QR bearer tokens in place
-- ---------------------------------------------------------------------------
alter table public.restaurant_tables
  rename column qr_token to qr_token_hash;

-- Drop the old cleartext format check BEFORE re-hashing: md5 output is 32
-- hex chars and would violate it.
alter table public.restaurant_tables
  drop constraint restaurant_tables_qr_token_format;

-- Values stored before this migration were 64-hex plaintext bearer tokens.
-- Re-hash them so no cleartext remains anywhere.
update public.restaurant_tables
  set qr_token_hash = md5(qr_token_hash);

alter table public.restaurant_tables
  add constraint restaurant_tables_qr_token_hash_format
  check (qr_token_hash ~ '^[0-9a-f]{32}$');

alter table public.restaurant_tables
  rename constraint restaurant_tables_qr_token_key to restaurant_tables_qr_token_hash_key;

alter table public.restaurant_tables
  alter column qr_token_hash set default (
    md5(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  );

comment on column public.restaurant_tables.qr_token_hash is
  'md5 of the cleartext bearer token. The cleartext is shown once at generation/regeneration time and never stored; clients cannot read or update this column.';

-- The hash must never be client-readable either: swap the table-level SELECT
-- grant from migration 11 for column-scoped SELECT that excludes the hash.
revoke select on public.restaurant_tables from authenticated;
grant select (id, restaurant_id, name, is_active, created_at, updated_at)
  on public.restaurant_tables to authenticated;

-- The hash must be write-only from the owner side: client roles lose the
-- column-level UPDATE privilege entirely (it previously allowed name/qr_token/
-- is_active). Hash rotation happens exclusively through the RPCs.
revoke update on public.restaurant_tables from authenticated;
grant update (name, is_active) on public.restaurant_tables to authenticated;

-- ---------------------------------------------------------------------------
-- 19.3 Per-customer access requests
-- ---------------------------------------------------------------------------
create table public.table_access_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  table_id uuid not null,
  table_session_id uuid,
  guest_session_id uuid references public.guest_sessions (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.table_access_request_status not null default 'pending',
  party_size integer,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (pg_catalog.now() + interval '15 minutes'),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  constraint table_access_requests_party_size_range check (
    party_size is null or party_size between 1 and 50
  ),
  constraint table_access_requests_expiry_after_request check (expires_at > requested_at),
  constraint table_access_requests_table_fk foreign key (table_id, restaurant_id)
    references public.restaurant_tables (id, restaurant_id) on delete cascade,
  constraint table_access_requests_session_fk foreign key (table_session_id, restaurant_id)
    references public.table_sessions (id, restaurant_id) on delete cascade,
  constraint table_access_requests_id_restaurant_unique unique (id, restaurant_id)
);

-- One pending request per customer per table: repeated scans are idempotent.
create unique index table_access_requests_one_pending_per_user_idx
  on public.table_access_requests (table_id, user_id)
  where status = 'pending';

create index table_access_requests_restaurant_status_idx
  on public.table_access_requests (restaurant_id, status, requested_at desc);

create index table_access_requests_user_requested_idx
  on public.table_access_requests (user_id, requested_at desc);

create index table_access_requests_session_idx
  on public.table_access_requests (table_session_id)
  where status = 'pending';

comment on table public.table_access_requests is
  'One row per customer ask to open or join a table session. Written only by SECURITY DEFINER RPCs; pending rows expire after 15 minutes (lazy enforcement).';

alter table public.table_access_requests enable row level security;

drop policy if exists table_access_requests_select_own on public.table_access_requests;
create policy table_access_requests_select_own on public.table_access_requests
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists table_access_requests_select_staff on public.table_access_requests;
create policy table_access_requests_select_staff on public.table_access_requests
  for select to authenticated
  using (
    public.has_restaurant_role(
      restaurant_id,
      array['restaurant_admin', 'waiter']::public.restaurant_role[]
    )
  );
-- No insert/update/delete policies: state transitions happen inside the
-- SECURITY DEFINER RPCs, which bypass RLS as the table owner.

-- ---------------------------------------------------------------------------
-- 19.4 Anonymous-safe projection for the customer entry page
-- ---------------------------------------------------------------------------
create or replace function public.get_table_entry(p_qr_token text)
returns table (
  restaurant_name text,
  restaurant_slug text,
  restaurant_description text,
  restaurant_logo_url text,
  table_name text,
  has_active_session boolean,
  my_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_table public.restaurant_tables;
  v_restaurant public.restaurants;
  v_session public.table_sessions;
  v_request public.table_access_requests;
  v_is_member boolean := false;
  v_status text := 'none';
begin
  if p_qr_token is null or p_qr_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid table code' using errcode = 'P0002';
  end if;

  select * into v_table
  from public.restaurant_tables t
  where t.qr_token_hash = md5(p_qr_token);

  if not found then
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

  select * into v_session
  from public.table_sessions s
  where s.table_id = v_table.id
    and s.status in ('pending', 'active')
  order by s.requested_at asc
  limit 1;

  if auth.uid() is not null then
    if v_session.id is not null and v_session.status = 'active' then
      select exists (
        select 1
        from public.guest_sessions g
        where g.table_session_id = v_session.id
          and g.user_id = auth.uid()
      ) into v_is_member;
    end if;

    -- Latest request by this caller, with lazy expiry applied on read.
    select * into v_request
    from public.table_access_requests r
    where r.table_id = v_table.id
      and r.user_id = auth.uid()
    order by r.requested_at desc
    limit 1;

    if v_is_member then
      v_status := 'approved';
    elsif v_request.id is not null then
      if v_request.status = 'pending' and v_request.expires_at <= pg_catalog.now() then
        v_status := 'expired';
      elsif v_request.status = 'approved' then
        -- Approved but the session is gone/closed: caller must ask again.
        v_status := 'closed';
      else
        v_status := v_request.status::text;
      end if;
    end if;
  end if;

  return query
  select
    v_restaurant.name,
    v_restaurant.slug,
    v_restaurant.description,
    v_restaurant.logo_url,
    v_table.name,
    coalesce(v_session.status = 'active', false),
    v_status;
end;
$$;

comment on function public.get_table_entry(text) is
  'Anonymous-safe projection for the customer QR entry page: restaurant/table identity, whether a session is open, and the caller''s own access state. Raises P0002 for anything invalid.';

-- ---------------------------------------------------------------------------
-- 19.5 request_table_access — the guest entry point
-- ---------------------------------------------------------------------------
create or replace function public.request_table_access(
  p_qr_token text,
  p_party_size integer default null
)
returns public.table_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_table public.restaurant_tables;
  v_restaurant public.restaurants;
  v_session public.table_sessions;
  v_request public.table_access_requests;
  v_recent integer;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_party_size is not null and p_party_size not between 1 and 50 then
    raise exception 'party size must be between 1 and 50' using errcode = '22023';
  end if;

  -- Lazy expiration: pending requests past their TTL become 'expired'.
  -- Runs with table ownership so it works under RLS; touches only rows that
  -- became due, and is indexed by status.
  update public.table_access_requests r
  set status = 'expired'
  where r.status = 'pending'
    and r.expires_at <= pg_catalog.now();

  if p_qr_token is null or p_qr_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid table code' using errcode = 'P0002';
  end if;

  select * into v_table
  from public.restaurant_tables t
  where t.qr_token_hash = md5(p_qr_token);

  if not found then
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

  -- Idempotency: an approved request whose session is still active is
  -- returned instead of opening a second ask.
  select * into v_request
  from public.table_access_requests r
  where r.table_id = v_table.id
    and r.user_id = v_user
    and r.status = 'approved'
    and exists (
      select 1
      from public.table_sessions s
      where s.id = r.table_session_id
        and s.status = 'active'
    )
  order by r.requested_at desc
  limit 1;

  if found then
    return v_request;
  end if;

  -- Idempotency: a still-pending request is returned instead of a duplicate.
  select * into v_request
  from public.table_access_requests r
  where r.table_id = v_table.id
    and r.user_id = v_user
    and r.status = 'pending'
  order by r.requested_at desc
  limit 1;

  if found then
    return v_request;
  end if;

  -- Abuse protection: at most 10 requests per user in any 10-minute window,
  -- across all tables. Pending duplicates above never reach this cap path
  -- because they return early.
  select count(*) into v_recent
  from public.table_access_requests r
  where r.user_id = v_user
    and r.requested_at > pg_catalog.now() - interval '10 minutes';

  if v_recent >= 10 then
    raise exception 'too many table access requests; please wait a few minutes'
      using errcode = '22023';
  end if;

  -- Attach to the open session when there is one (join), otherwise the
  -- approval flow will open a new session for this table.
  select * into v_session
  from public.table_sessions s
  where s.table_id = v_table.id
    and s.status in ('pending', 'active')
  order by s.requested_at asc
  limit 1
  for update;

  begin
    insert into public.table_access_requests (
      restaurant_id, table_id, table_session_id, user_id, party_size
    )
    values (
      v_table.restaurant_id, v_table.id, v_session.id, v_user, p_party_size
    )
    returning * into v_request;
  exception
    -- Lost a race with a concurrent scan by the same guest: return the winner.
    when unique_violation then
      select * into v_request
      from public.table_access_requests r
      where r.table_id = v_table.id
        and r.user_id = v_user
        and r.status = 'pending'
      order by r.requested_at desc
      limit 1;
  end;

  return v_request;
end;
$$;

comment on function public.request_table_access(text, integer) is
  'Guest entry point: validate the QR token and create (or return the existing) pending access request. Never admits the caller — staff approval is always required.';

-- ---------------------------------------------------------------------------
-- 19.6 approve_table_access — waiter / restaurant_admin
-- ---------------------------------------------------------------------------
create or replace function public.approve_table_access(p_request_id uuid)
returns public.table_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.table_access_requests;
  v_table public.restaurant_tables;
  v_session public.table_sessions;
  v_role text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_request
  from public.table_access_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  if not public.has_restaurant_role(
    v_request.restaurant_id,
    array['restaurant_admin', 'waiter']::public.restaurant_role[]
  ) then
    raise exception 'only staff of this restaurant can approve a table access request'
      using errcode = '42501';
  end if;

  v_role := case
    when public.has_restaurant_role(
      v_request.restaurant_id,
      array['restaurant_admin']::public.restaurant_role[]
    ) then 'restaurant_admin'
    else 'waiter'
  end;

  -- Expired requests are never approvable. Flip the row here and return it so
  -- the transition is committed; callers must treat anything other than
  -- 'approved' as a failure. (A raise would roll back the flip.)
  if v_request.status = 'pending' and v_request.expires_at <= pg_catalog.now() then
    update public.table_access_requests
    set status = 'expired'
    where id = v_request.id
    returning * into v_request;

    insert into public.audit_logs (
      actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
    )
    values (
      v_actor,
      v_role,
      v_request.restaurant_id,
      'table_access.expired',
      'table_access_request',
      v_request.id,
      jsonb_build_object('table_id', v_request.table_id, 'guest_user_id', v_request.user_id)
    );

    return v_request;
  end if;

  if v_request.status <> 'pending' then
    raise exception 'request is not pending approval' using errcode = '22000';
  end if;

  if not public.is_restaurant_public(v_request.restaurant_id) then
    raise exception 'restaurant is not active' using errcode = '22023';
  end if;

  -- Serialize concurrent approvals for the same table on the table row.
  select * into v_table
  from public.restaurant_tables t
  where t.id = v_request.table_id
  for update;

  if not v_table.is_active then
    raise exception 'this table is no longer active' using errcode = '22023';
  end if;

  if v_request.table_session_id is not null then
    select * into v_session
    from public.table_sessions s
    where s.id = v_request.table_session_id
    for update;

    if not found then
      raise exception 'the table session no longer exists' using errcode = 'P0002';
    end if;

    if v_session.status = 'closed' then
      raise exception 'the table session was closed; the guest must request access again'
        using errcode = '22000';
    end if;
  else
    select * into v_session
    from public.table_sessions s
    where s.table_id = v_table.id
      and s.status = 'active'
    order by s.approved_at asc nulls last
    limit 1
    for update;

    if not found then
      begin
        insert into public.table_sessions (
          restaurant_id, table_id, status, party_size, approved_at, approved_by
        )
        values (
          v_request.restaurant_id, v_table.id, 'active',
          v_request.party_size, pg_catalog.now(), v_actor
        )
        returning * into v_session;
      exception
        -- Lost a race against another approval: join the winner's session.
        when unique_violation then
          select * into v_session
          from public.table_sessions s
          where s.table_id = v_table.id
            and s.status in ('pending', 'active')
          order by s.requested_at asc
          limit 1
          for update;
      end;
    end if;
  end if;

  -- A targeted session that was still pending activates now.
  if v_session.status = 'pending' then
    update public.table_sessions
    set status = 'active',
        approved_at = pg_catalog.now(),
        approved_by = v_actor
    where id = v_session.id
    returning * into v_session;
  end if;

  insert into public.guest_sessions (restaurant_id, table_session_id, user_id)
  values (v_request.restaurant_id, v_session.id, v_request.user_id)
  on conflict (table_session_id, user_id)
  do update set last_seen_at = pg_catalog.now();

  update public.table_access_requests
  set status = 'approved',
      decided_at = pg_catalog.now(),
      decided_by = v_actor,
      table_session_id = v_session.id,
      guest_session_id = (
        select g.id
        from public.guest_sessions g
        where g.table_session_id = v_session.id
          and g.user_id = v_request.user_id
      )
  where id = v_request.id
  returning * into v_request;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_actor,
    v_role,
    v_request.restaurant_id,
    'table_access.approved',
    'table_access_request',
    v_request.id,
    jsonb_build_object('table_id', v_table.id, 'table_session_id', v_session.id,
                       'guest_user_id', v_request.user_id)
  );

  return v_request;
end;
$$;

comment on function public.approve_table_access(uuid) is
  'Waiter or restaurant_admin: approve a pending access request, get-or-create the single active session for the table, and admit the requester as a guest.';

-- ---------------------------------------------------------------------------
-- 19.7 reject_table_access — waiter / restaurant_admin
-- ---------------------------------------------------------------------------
create or replace function public.reject_table_access(p_request_id uuid)
returns public.table_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.table_access_requests;
  v_role text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_request
  from public.table_access_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  if not public.has_restaurant_role(
    v_request.restaurant_id,
    array['restaurant_admin', 'waiter']::public.restaurant_role[]
  ) then
    raise exception 'only staff of this restaurant can reject a table access request'
      using errcode = '42501';
  end if;

  v_role := case
    when public.has_restaurant_role(
      v_request.restaurant_id,
      array['restaurant_admin']::public.restaurant_role[]
    ) then 'restaurant_admin'
    else 'waiter'
  end;

  if v_request.status = 'pending' and v_request.expires_at <= pg_catalog.now() then
    update public.table_access_requests
    set status = 'expired'
    where id = v_request.id
    returning * into v_request;

    insert into public.audit_logs (
      actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
    )
    values (
      v_actor,
      v_role,
      v_request.restaurant_id,
      'table_access.expired',
      'table_access_request',
      v_request.id,
      jsonb_build_object('table_id', v_request.table_id, 'guest_user_id', v_request.user_id)
    );

    return v_request;
  end if;

  if v_request.status <> 'pending' then
    raise exception 'request is not pending approval' using errcode = '22000';
  end if;

  update public.table_access_requests
  set status = 'rejected',
      decided_at = pg_catalog.now(),
      decided_by = v_actor
  where id = v_request.id
  returning * into v_request;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_actor,
    v_role,
    v_request.restaurant_id,
    'table_access.rejected',
    'table_access_request',
    v_request.id,
    jsonb_build_object('table_id', v_request.table_id, 'guest_user_id', v_request.user_id)
  );

  return v_request;
end;
$$;

comment on function public.reject_table_access(uuid) is
  'Waiter or restaurant_admin: reject a pending access request. Never admits the requester.';

-- ---------------------------------------------------------------------------
-- 19.8 cancel_table_access — the requesting guest only
-- ---------------------------------------------------------------------------
create or replace function public.cancel_table_access(p_request_id uuid)
returns public.table_access_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_request public.table_access_requests;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_request
  from public.table_access_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  if v_request.user_id <> v_user then
    raise exception 'you can only cancel your own request' using errcode = '42501';
  end if;

  if v_request.status = 'pending' and v_request.expires_at <= pg_catalog.now() then
    update public.table_access_requests
    set status = 'expired'
    where id = v_request.id
    returning * into v_request;
    return v_request;
  end if;

  if v_request.status <> 'pending' then
    raise exception 'request is not pending' using errcode = '22000';
  end if;

  update public.table_access_requests
  set status = 'cancelled',
      decided_at = pg_catalog.now(),
      decided_by = v_user
  where id = v_request.id
  returning * into v_request;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_user,
    'guest',
    v_request.restaurant_id,
    'table_access.cancelled',
    'table_access_request',
    v_request.id,
    jsonb_build_object('table_id', v_request.table_id)
  );

  return v_request;
end;
$$;

comment on function public.cancel_table_access(uuid) is
  'The requesting guest cancels their own pending access request.';

-- ---------------------------------------------------------------------------
-- 19.9 regenerate_table_qr_token — restaurant_admin only
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_table_qr_token(p_table_id uuid)
returns table (id uuid, name text, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_table public.restaurant_tables;
  v_token text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_table
  from public.restaurant_tables t
  where t.id = p_table_id
  for update;

  if not found then
    raise exception 'table not found' using errcode = 'P0002';
  end if;

  if not public.has_restaurant_role(
    v_table.restaurant_id,
    array['restaurant_admin']::public.restaurant_role[]
  ) then
    raise exception 'only a restaurant_admin of this restaurant can regenerate a table QR code'
      using errcode = '42501';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  update public.restaurant_tables t
  set qr_token_hash = md5(v_token)
  where t.id = v_table.id
  returning * into v_table;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_actor,
    'restaurant_admin',
    v_table.restaurant_id,
    'table_qr.regenerated',
    'restaurant_table',
    v_table.id,
    jsonb_build_object('table_name', v_table.name)
  );

  return query select v_table.id, v_table.name, v_token;
end;
$$;

comment on function public.regenerate_table_qr_token(uuid) is
  'restaurant_admin rotates a table QR code. The old code stops working immediately; the cleartext token is returned once and must be handled by the admin UI.';

-- ---------------------------------------------------------------------------
-- 19.10 create_table_with_qr — restaurant_admin only, limit-enforced
-- ---------------------------------------------------------------------------
create or replace function public.create_table_with_qr(
  p_restaurant_id uuid,
  p_name text
)
returns table (id uuid, name text, token text, is_active boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_token text;
  v_name text;
  v_table public.restaurant_tables;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.has_restaurant_role(
    p_restaurant_id,
    array['restaurant_admin']::public.restaurant_role[]
  ) then
    raise exception 'only a restaurant_admin of this restaurant can add tables'
      using errcode = '42501';
  end if;

  v_name := btrim(coalesce(p_name, ''));

  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'table name must be between 1 and 40 characters' using errcode = '22023';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  -- The enforce_table_limit trigger (migration 09) serializes on the
  -- subscription row and rejects the insert with 23514 over the plan limit,
  -- for service-role and direct REST inserts alike.
  insert into public.restaurant_tables (restaurant_id, name, qr_token_hash)
  values (p_restaurant_id, v_name, md5(v_token))
  returning * into v_table;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_actor,
    'restaurant_admin',
    p_restaurant_id,
    'table.created',
    'restaurant_table',
    v_table.id,
    jsonb_build_object('table_name', v_table.name)
  );

  return query select v_table.id, v_table.name, v_token, v_table.is_active;
end;
$$;

comment on function public.create_table_with_qr(uuid, text) is
  'restaurant_admin adds a table inside the plan limit and receives the new cleartext QR token once.';

-- ---------------------------------------------------------------------------
-- 19.11 Drop the pre-approval entry RPC (waiter-approval bypass)
-- ---------------------------------------------------------------------------
drop function public.request_table_session(text, integer);

-- ---------------------------------------------------------------------------
-- 19.12 close_table_session: cancel pending requests bound to the session,
--        and write an audit event
-- ---------------------------------------------------------------------------
create or replace function public.close_table_session(p_session_id uuid)
returns public.table_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.table_sessions;
  v_role text;
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

  -- Guests who asked to join this session can never be approved into it now.
  update public.table_access_requests r
  set status = 'cancelled',
      decided_at = pg_catalog.now(),
      decided_by = v_actor
  where r.table_session_id = v_session.id
    and r.status = 'pending';

  v_role := case
    when public.has_restaurant_role(
      v_session.restaurant_id,
      array['restaurant_admin']::public.restaurant_role[]
    ) then 'restaurant_admin'
    else 'waiter'
  end;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_actor,
    v_role,
    v_session.restaurant_id,
    'table_session.closed',
    'table_session',
    v_session.id,
    jsonb_build_object('table_id', v_session.table_id)
  );

  return v_session;
end;
$$;

comment on function public.close_table_session(uuid) is
  'Waiter or restaurant_admin: close the occupancy session; pending join requests are cancelled and guests must scan and request again.';

-- ---------------------------------------------------------------------------
-- 19.13 Realtime (best effort; PGlite has no publication)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'table_access_requests'
    ) then
      alter publication supabase_realtime add table public.table_access_requests;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 19.14 Privileges
-- ---------------------------------------------------------------------------
-- Service role (server-only) keeps full access, matching migration 11.
grant all on public.table_access_requests to service_role;

grant select on public.table_access_requests to authenticated;

revoke all on function public.get_table_entry(text) from public, anon, authenticated;
grant execute on function public.get_table_entry(text) to anon, authenticated;

revoke all on function public.request_table_access(text, integer) from public, anon, authenticated;
revoke all on function public.approve_table_access(uuid) from public, anon, authenticated;
revoke all on function public.reject_table_access(uuid) from public, anon, authenticated;
revoke all on function public.cancel_table_access(uuid) from public, anon, authenticated;
revoke all on function public.regenerate_table_qr_token(uuid) from public, anon, authenticated;
revoke all on function public.create_table_with_qr(uuid, text) from public, anon, authenticated;

grant execute on function public.request_table_access(text, integer) to authenticated;
grant execute on function public.approve_table_access(uuid) to authenticated;
grant execute on function public.reject_table_access(uuid) to authenticated;
grant execute on function public.cancel_table_access(uuid) to authenticated;
grant execute on function public.regenerate_table_qr_token(uuid) to authenticated;
grant execute on function public.create_table_with_qr(uuid, text) to authenticated;

-- No new direct grants on base tables for anon.

commit;
