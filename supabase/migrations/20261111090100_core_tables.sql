-- =============================================================================
-- Mezo — 02. Platform, profiles, restaurants, membership, applications
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- profiles
-- One row per Supabase Auth user, including anonymous guest users created by
-- 'sign in anonymously'. RLS restricts reads to the owner, colleagues in a
-- shared restaurant, and platform admins.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (
    full_name is null or char_length(full_name) between 1 and 120
  ),
  constraint profiles_phone_format check (
    phone is null or phone ~ '^\+?[0-9]{7,15}$'
  ),
  constraint profiles_avatar_url_length check (
    avatar_url is null or char_length(avatar_url) <= 2048
  )
);

comment on table public.profiles is
  'Application profile for every auth user. Guest customers get a profile too.';

-- ---------------------------------------------------------------------------
-- platform_admins
-- Separate from restaurant membership on purpose: no restaurant role can ever
-- imply platform access. Rows are provisioned with the service role or SQL.
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Platform administrators. Managed outside the application UI.';

-- ---------------------------------------------------------------------------
-- restaurants
-- A restaurant is the tenant boundary. Every tenant-owned row carries
-- restaurant_id so policies never need multi-hop joins.
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  contact_email text,
  contact_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  country_code text not null default 'TZ',
  application_status public.application_status not null default 'pending',
  operational_status public.operational_status not null default 'suspended',
  subscription_status public.subscription_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_name_length check (char_length(name) between 2 and 120),
  constraint restaurants_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint restaurants_description_length check (
    description is null or char_length(description) <= 2000
  ),
  constraint restaurants_email_format check (
    contact_email is null or contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint restaurants_country_format check (country_code ~ '^[A-Z]{2}$'),
  -- A restaurant cannot be live before approval.
  constraint restaurants_active_requires_approval check (
    operational_status <> 'active' or application_status = 'approved'
  )
);

create index restaurants_application_status_idx
  on public.restaurants (application_status, operational_status);

create index restaurants_created_by_idx on public.restaurants (created_by);

comment on table public.restaurants is
  'Tenant root. Publicly readable only when approved and active.';

-- ---------------------------------------------------------------------------
-- restaurant_members
-- Tenant-scoped staff. A user may belong to several restaurants; membership in
-- one grants nothing in another.
-- ---------------------------------------------------------------------------
create table public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.restaurant_role not null,
  is_active boolean not null default true,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_members_unique_user unique (restaurant_id, user_id)
);

create index restaurant_members_user_idx
  on public.restaurant_members (user_id)
  where is_active;

create index restaurant_members_restaurant_role_idx
  on public.restaurant_members (restaurant_id, role)
  where is_active;

comment on table public.restaurant_members is
  'Restaurant staff membership. Roles: restaurant_admin, waiter, kitchen.';

-- ---------------------------------------------------------------------------
-- restaurant_applications
-- One reviewable application per restaurant. Approval is performed through
-- public.review_restaurant_application() so the membership row and the
-- restaurant status change atomically.
-- ---------------------------------------------------------------------------
create table public.restaurant_applications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  applicant_user_id uuid not null references public.profiles (id) on delete cascade,
  applicant_name text,
  applicant_phone text,
  message text,
  status public.application_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_applications_message_length check (
    message is null or char_length(message) <= 2000
  ),
  constraint restaurant_applications_rejection_length check (
    rejection_reason is null or char_length(rejection_reason) <= 2000
  ),
  -- A reviewed application must record who reviewed it and when.
  constraint restaurant_applications_review_complete check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null and reviewed_by is not null)
  )
);

create unique index restaurant_applications_one_pending_idx
  on public.restaurant_applications (restaurant_id)
  where status = 'pending';

create index restaurant_applications_applicant_idx
  on public.restaurant_applications (applicant_user_id, created_at desc);

create index restaurant_applications_status_idx
  on public.restaurant_applications (status, created_at);

comment on table public.restaurant_applications is
  'Restaurant onboarding applications reviewed by platform admins only.';

commit;
