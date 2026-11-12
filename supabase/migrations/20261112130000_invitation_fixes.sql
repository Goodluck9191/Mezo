-- =============================================================================
-- Mezo — 15. Staff invitation fixes (grants, policies, portable RPCs)
-- =============================================================================
-- Applied on top of 20261112120000_staff_invitations.sql. This migration:
--
--   1. Grants authenticated column-scoped SELECT on restaurant_staff_invitations
--      (revoke was deferred to this migration; token_hash stays invisible).
--   2. Adds public.current_user_email() as SECURITY DEFINER so RLS policies
--      can compare the caller's email without reading auth.users directly
--      (client roles have no privilege on auth.users).
--   3. Recreates invite_restaurant_staff / accept_restaurant_invitation with
--      qualified column references (their OUT parameters shadow unqualified
--      column names and raised SQLSTATE 42702) and without pgcrypto, so the
--      functions are portable across vanilla PostgreSQL, PGlite and staging.
--      Cleartext tokens are never stored: the table keeps only a hash.
-- =============================================================================

begin;

-- Operator-visible columns only. token_hash stays invisible to client roles.
grant select (
  id,
  restaurant_id,
  email,
  role,
  status,
  invited_by,
  accepted_user_id,
  accepted_at,
  expires_at,
  created_at,
  updated_at
) on public.restaurant_staff_invitations to authenticated;

-- Service role (server-only) keeps full access, matching migration 11.
grant all on public.restaurant_staff_invitations to service_role;

-- ---------------------------------------------------------------------------
-- public.current_user_email() — email of the caller, for RLS comparisons.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select au.email from auth.users au where au.id = auth.uid()),
    ''
  )
$$;

comment on function public.current_user_email() is
  'Email of the current user; usable inside RLS policies. Empty when the account has none.';

revoke execute on function public.current_user_email() from public, anon;
grant execute on function public.current_user_email() to authenticated, service_role;

-- Recreate the self-select policy without touching auth.users directly.
drop policy restaurant_staff_invitations_self_select on public.restaurant_staff_invitations;

create policy restaurant_staff_invitations_self_select on public.restaurant_staff_invitations
  for select
  to authenticated
  using (
    lower(email) = lower(public.current_user_email())
  );

-- ---------------------------------------------------------------------------
-- public.invite_restaurant_staff(...) — portable, unambiguous.
-- Tokens are 64 lowercase hex chars (two v4 UUIDs, ~244 bits of entropy).
-- token_hash is md5(token): unsalted by design, safe because the input has
-- 244 bits of entropy, and keeps the function portable (no pgcrypto).
-- ---------------------------------------------------------------------------
create or replace function public.invite_restaurant_staff(
  p_restaurant_id uuid,
  p_email text,
  p_role public.restaurant_role
)
returns table (
  id uuid,
  restaurant_id uuid,
  email text,
  role public.restaurant_role,
  status public.staff_invitation_status,
  expires_at timestamptz,
  token text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_token text;
  v_token_hash text;
  v_email text;
  v_invitation public.restaurant_staff_invitations;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.has_restaurant_role(
    p_restaurant_id,
    array['restaurant_admin']::public.restaurant_role[]
  ) then
    raise exception 'only a restaurant_admin of this restaurant can invite staff'
      using errcode = '42501';
  end if;

  if p_role not in ('waiter', 'kitchen') then
    raise exception 'only waiter or kitchen roles can be invited; restaurant_admin is granted by platform review'
      using errcode = '22023';
  end if;

  v_email := lower(btrim(p_email));

  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email address' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.restaurant_staff_invitations i
    where i.restaurant_id = p_restaurant_id
      and lower(i.email) = v_email
      and i.role = p_role
      and i.status = 'pending'
      and i.expires_at > now()
  ) then
    raise exception 'a pending invitation already exists for this email and role'
      using errcode = '23505';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := md5(v_token);

  insert into public.restaurant_staff_invitations as i
    (restaurant_id, email, role, token_hash, invited_by)
  values
    (p_restaurant_id, v_email, p_role, v_token_hash, v_caller)
  returning * into v_invitation;

  return query
  select v_invitation.id, v_invitation.restaurant_id, v_invitation.email,
         v_invitation.role, v_invitation.status, v_invitation.expires_at, v_token;
end;
$$;

comment on function public.invite_restaurant_staff(uuid, text, public.restaurant_role) is
  'restaurant_admin invites a waiter/kitchen to the restaurant. Returns the cleartext token ONCE; share it privately with the invitee.';

-- ---------------------------------------------------------------------------
-- public.accept_restaurant_invitation(p_token) — portable, unambiguous.
-- ---------------------------------------------------------------------------
create or replace function public.accept_restaurant_invitation(
  p_token text
)
returns table (
  restaurant_id uuid,
  restaurant_name text,
  restaurant_slug text,
  role public.restaurant_role
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_invitation public.restaurant_staff_invitations;
  v_caller_email text;
  v_restaurant public.restaurants;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select au.email into v_caller_email
  from auth.users au
  where au.id = v_caller;

  if v_caller_email is null or v_caller_email = '' then
    raise exception 'your account must have an email address to accept a staff invitation'
      using errcode = '22023';
  end if;

  select * into v_invitation
  from public.restaurant_staff_invitations i
  where i.token_hash = md5(p_token)
    and i.status = 'pending'
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'invitation is invalid, expired or already used'
      using errcode = 'P0002';
  end if;

  if lower(v_invitation.email) <> lower(v_caller_email) then
    raise exception 'this invitation is addressed to a different email'
      using errcode = '42501';
  end if;

  insert into public.restaurant_members as m
    (restaurant_id, user_id, role, invited_by)
  values (v_invitation.restaurant_id, v_caller, v_invitation.role, v_invitation.invited_by)
  on conflict on constraint restaurant_members_unique_user
  do update set
    role = excluded.role,
    is_active = true;

  update public.restaurant_staff_invitations
  set status = 'accepted',
      accepted_user_id = v_caller,
      accepted_at = now()
  where id = v_invitation.id;

  select * into v_restaurant from public.restaurants where id = v_invitation.restaurant_id;

  return query
  select v_invitation.restaurant_id,
         v_restaurant.name,
         v_restaurant.slug,
         v_invitation.role;
end;
$$;

comment on function public.accept_restaurant_invitation(text) is
  'Accepts a single-use invitation token issued by invite_restaurant_staff(); grants the specified waiter or kitchen role at the restaurant.';

commit;
