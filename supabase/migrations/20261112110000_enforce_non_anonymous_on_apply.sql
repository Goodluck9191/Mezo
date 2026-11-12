-- =============================================================================
-- Mezo — 13. Block anonymous users from submitting restaurant applications
-- =============================================================================
-- Background: Supabase anonymous users are real rows in auth.users and carry
--   aud = "authenticated", role = "authenticated", is_anonymous = true
-- in their JWT. They therefore match every `to authenticated` grant and every
-- `so we can rely on auth.uid()`. apply_for_restaurant() accepts any
-- authenticated caller, which would let anonymous visitors register restaurants
-- they do not own.
--
-- Fix: refuse callers whose JWT has is_anonymous = true. Ordinary registered
-- users are unaffected. Guest sessions created for the QR-ordering flow keep
-- working — they never call this RPC.
-- =============================================================================

begin;

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

  -- Reject anonymous sign-ins. They carry is_anonymous = true in the JWT.
  if (auth.jwt() ->> 'is_anonymous')::boolean then
    raise exception 'anonymous users cannot submit restaurant applications'
      using errcode = '42501';
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
  'Authenticated (non-anonymous) user applies to register a restaurant.';

commit;
