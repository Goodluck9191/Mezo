-- =============================================================================
-- Mezo — 16. Restaurant slug immutability + anonymous acceptance guard
-- =============================================================================
-- Follow-up security review, applied on top of 20261112120000 and
-- 20261112130000.
--
-- 1. `slug` was part of the owner-editable UPDATE grant on public.restaurants,
--    so any authenticated member (including a restaurant_admin of the
--    restaurant) could rename a live tenant's public handle with a direct
--    REST call. This migration revokes slug from the client grant entirely.
--    The only paths that write slug now are database-internal (SECURITY
--    DEFINER RPCs, e.g. apply_for_restaurant) and the service role.
--
-- 2. protect_restaurant_review_fields() gains slug as a guarded column:
--    non-platform-admin callers get 42501 — defense in depth should that
--    grant ever widen in a future migration. Platform approval functionality
--    (review_restaurant_application) is unaffected: it never writes slug.
--
-- 3. accept_restaurant_invitation() now rejects anonymous JWT callers before
--    any work, closing the "anonymous session with a matching email" edge in
--    the lifecycle. No other behavior changes.
-- =============================================================================

begin;

-- 1. Slice slug out of the client UPDATE grant. Remaining columns unchanged.
revoke update (slug) on public.restaurants from authenticated;

-- 2. Defense in depth: slug becomes a guarded review/lifecycle-style field.
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
     or new.approved_by is distinct from old.approved_by
     or new.slug is distinct from old.slug then
    if not public.is_platform_admin() then
      raise exception 'only platform administrators can change review, lifecycle or slug fields'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.protect_restaurant_review_fields() is
  'Blocks non-platform-admin writes to application_status, operational_status, subscription_status, approval metadata and slug.';

-- 3. Reject anonymous JWT callers before any lookup or lock.
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

  -- Anonymous sessions carry no verified email identity; they can never accept.
  if lower(coalesce(auth.jwt() ->> 'is_anonymous', 'false')) = 'true' then
    raise exception 'anonymous users cannot accept staff invitations'
      using errcode = '42501';
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
  'Accepts a single-use invitation token issued by invite_restaurant_staff(); grants the specified waiter or kitchen role at the restaurant. Rejects anonymous sessions.';

commit;
