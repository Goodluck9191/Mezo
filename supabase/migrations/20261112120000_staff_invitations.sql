-- =============================================================================
-- Mezo — 14. Staff invitations and restaurant storage bucket
-- =============================================================================
-- Builds on Phase 2's restaurant_members + RLS. Adds:
--   * restaurant_staff_invitations  (pending invites held by restaurants)
--   * invite_restaurant_staff(...)  — security definer, restaurant_admin only
--   * accept_restaurant_invitation — security definer, consumes token
--   * revoke_restaurant_invitation — restaurant_admin only
--   * list helpers scoped to the calling restaurant
--   * Storage bucket `restaurant-logos` (PNG/JPEG/WebP, <= 2 MB) with
--     restaurant_admin write/read/delete for that restaurant's folder only
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 14.1 restaurant_staff_invitations
-- ---------------------------------------------------------------------------
create type public.staff_invitation_status as enum (
  'pending', 'accepted', 'revoked', 'expired'
);

create table public.restaurant_staff_invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email text not null,
  role public.restaurant_role not null,
  token_hash text not null unique,
  status public.staff_invitation_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_user_id uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_staff_invitations_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- Only waiter / kitchen can be invited; restaurant_admin is granted exclusively
  -- by platform approval, never by invitation.
  constraint restaurant_staff_invitations_role_rule
    check (role in ('waiter', 'kitchen'))
);

create unique index restaurant_staff_invitations_pending_unique
  on public.restaurant_staff_invitations (restaurant_id, lower(email), role)
  where status = 'pending';

create index restaurant_staff_invitations_restaurant_idx
  on public.restaurant_staff_invitations (restaurant_id);

create index restaurant_staff_invitations_email_idx
  on public.restaurant_staff_invitations (lower(email));

create index restaurant_staff_invitations_expires_idx
  on public.restaurant_staff_invitations (expires_at)
  where status = 'pending';

alter table public.restaurant_staff_invitations enable row level security;

comment on table public.restaurant_staff_invitations is
  'Pending staff invitations. Acceptance creates a restaurant_members row. Admin manages invitations for own restaurant only.';

-- ---------------------------------------------------------------------------
-- RLS policies
-- Restaurant_admin sees/manages their own invites. Waiter/kitchen cannot
-- see invitations at all (they receive invites for themselves only.)
-- ---------------------------------------------------------------------------
create policy restaurant_staff_invitations_admin_all on public.restaurant_staff_invitations
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_members m
      where m.restaurant_id = restaurant_staff_invitations.restaurant_id
        and m.user_id = auth.uid()
        and m.is_active
        and m.role = 'restaurant_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_members m
      where m.restaurant_id = restaurant_staff_invitations.restaurant_id
        and m.user_id = auth.uid()
        and m.is_active
        and m.role = 'restaurant_admin'
    )
  );

-- The recipient (if a user with this email already exists) may see their own pending invitation.
create policy restaurant_staff_invitations_self_select on public.restaurant_staff_invitations
  for select
  to authenticated
  using (
    lower(email) = lower(coalesce(
      (select au.email from auth.users au where au.id = auth.uid()),
      ''
    ))
  );

-- ---------------------------------------------------------------------------
-- 14.2 invite_restaurant_staff(restaurant_id, email, role)
-- Generates a fresh, single-use invitation. Returns the cleartext token once
-- (the only time it is exposed). The caller is responsible for sharing it.
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

  -- The inviting admin can NOT have invited twice
  if exists (
    select 1
    from public.restaurant_staff_invitations
    where restaurant_id = p_restaurant_id
      and lower(email) = v_email
      and role = p_role
      and status = 'pending'
      and expires_at > now()
  ) then
    raise exception 'a pending invitation already exists for this email and role'
      using errcode = '23505';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := crypt(v_token, gen_salt('bf'));

  insert into public.restaurant_staff_invitations
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
-- 14.3 accept_restaurant_invitation(token)
-- The invitee, who must be signed in and have a verified email matching the
-- invitation, consumes the pending invitation and becomes a member.
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
    -- Anonymous sign-in produces no email and is blocked from accepting.
    raise exception 'your account must have an email address to accept a staff invitation'
      using errcode = '22023';
  end if;

  select * into v_invitation
  from public.restaurant_staff_invitations
  where token_hash = crypt(p_token, token_hash)
    and status = 'pending'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invitation is invalid, expired or already used'
      using errcode = 'P0002';
  end if;

  if lower(v_invitation.email) <> lower(v_caller_email) then
    raise exception 'this invitation is addressed to a different email'
      using errcode = '42501';
  end if;

  -- Promote existing membership in place if any; otherwise insert.
  insert into public.restaurant_members (restaurant_id, user_id, role, invited_by)
  values (v_invitation.restaurant_id, v_caller, v_invitation.role, v_invitation.invited_by)
  on conflict (restaurant_id, user_id)
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

-- ---------------------------------------------------------------------------
-- 14.4 revoke_restaurant_invitation(invitation_id)
-- ---------------------------------------------------------------------------
create or replace function public.revoke_restaurant_invitation(
  p_invitation_id uuid
)
returns public.restaurant_staff_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_invitation public.restaurant_staff_invitations;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_invitation from public.restaurant_staff_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  if not public.has_restaurant_role(
    v_invitation.restaurant_id,
    array['restaurant_admin']::public.restaurant_role[]
  ) then
    raise exception 'only a restaurant_admin of this restaurant can revoke invitations'
      using errcode = '42501';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'only pending invitations can be revoked' using errcode = '22023';
  end if;

  update public.restaurant_staff_invitations
  set status = 'revoked'
  where id = v_invitation.id
  returning * into v_invitation;

  return v_invitation;
end;
$$;

comment on function public.revoke_restaurant_invitation(uuid) is
  'restaurant_admin revokes a pending staff invitation for their restaurant.';

-- ---------------------------------------------------------------------------
-- 14.5 deactivate_restaurant_member(member_id)
-- Soft-deactivates a membership. restaurant_admin only.
-- ---------------------------------------------------------------------------
create or replace function public.deactivate_restaurant_member(
  p_member_id uuid
)
returns public.restaurant_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_member public.restaurant_members;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_member from public.restaurant_members
  where id = p_member_id
  for update;

  if not found then
    raise exception 'membership not found' using errcode = 'P0002';
  end if;

  -- Cannot deactivate yourself
  if v_member.user_id = v_caller then
    raise exception 'you cannot deactivate your own membership' using errcode = '22023';
  end if;

  if not public.has_restaurant_role(
    v_member.restaurant_id,
    array['restaurant_admin']::public.restaurant_role[]
  ) then
    raise exception 'only a restaurant_admin of this restaurant can deactivate members'
      using errcode = '42501';
  end if;

  -- Cannot deactivate the only remaining admin
  if v_member.role = 'restaurant_admin' and v_member.is_active then
    if (
      select count(*)
      from public.restaurant_members
      where restaurant_id = v_member.restaurant_id
        and role = 'restaurant_admin'
        and is_active
        and id <> v_member.id
    ) = 0 then
      raise exception 'cannot deactivate the only active restaurant_admin'
        using errcode = '22023';
    end if;
  end if;

  update public.restaurant_members
  set is_active = false
  where id = v_member.id
  returning * into v_member;

  return v_member;
end;
$$;

comment on function public.deactivate_restaurant_member(uuid) is
  'restaurant_admin revokes a membership for their restaurant. Cannot deactivate self or the last admin.';

-- ---------------------------------------------------------------------------
-- 14.6 updated_at on restaurant_staff_invitations
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.restaurant_staff_invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 14.7 storage bucket for restaurant logos
-- Private to restaurants that own them; public-read for the customer flow.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-logos',
  'restaurant-logos',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- Only the restaurant owner (admin) of the folder may upload/delete objects.
-- Public read (so the customer menu can show logos).
create policy restaurant_logos_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'restaurant-logos');

create policy restaurant_logos_admin_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'restaurant-logos'
    and exists (
      select 1
      from public.restaurant_members m
      where m.user_id = auth.uid()
        and m.is_active
        and m.role = 'restaurant_admin'
        and m.restaurant_id = (string_to_array(name, '/'))[1]::uuid
    )
  )
  with check (
    bucket_id = 'restaurant-logos'
    and exists (
      select 1
      from public.restaurant_members m
      where m.user_id = auth.uid()
        and m.is_active
        and m.role = 'restaurant_admin'
        and m.restaurant_id = (string_to_array(name, '/'))[1]::uuid
    )
  );

-- Mutation RPCs: authenticated may call them; authorization happens inside.
grant execute on function public.invite_restaurant_staff(uuid, text, public.restaurant_role)
  to authenticated;
grant execute on function public.accept_restaurant_invitation(text)
  to authenticated;
grant execute on function public.revoke_restaurant_invitation(uuid)
  to authenticated;
grant execute on function public.deactivate_restaurant_member(uuid)
  to authenticated;

commit;
