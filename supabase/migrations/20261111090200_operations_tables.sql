-- =============================================================================
-- Mezo — 03. Tables, menu, table sessions, guest sessions
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- restaurant_tables
-- qr_token is the only thing a QR code needs to carry. It is 244 bits of
-- random data (two UUIDs, hex-encoded), never a sequential ID. Rotating a
-- token invalidates every printed code for that table.
-- ---------------------------------------------------------------------------
create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  qr_token text not null unique default (
    replace(gen_random_uuid()::text, '-', '')
    || replace(gen_random_uuid()::text, '-', '')
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_tables_name_length check (char_length(name) between 1 and 40),
  constraint restaurant_tables_qr_token_format check (qr_token ~ '^[0-9a-f]{64}$'),
  -- Composite key so children can prove they point at the same restaurant.
  constraint restaurant_tables_id_restaurant_unique unique (id, restaurant_id),
  constraint restaurant_tables_name_unique unique (restaurant_id, name)
);

create index restaurant_tables_restaurant_active_idx
  on public.restaurant_tables (restaurant_id, is_active);

comment on table public.restaurant_tables is
  'Physical tables. qr_token is a secret bearer value: staff-only access.';

-- ---------------------------------------------------------------------------
-- menu_categories
-- ---------------------------------------------------------------------------
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_categories_name_length check (char_length(name) between 1 and 80),
  constraint menu_categories_description_length check (
    description is null or char_length(description) <= 1000
  ),
  constraint menu_categories_sort_order_non_negative check (sort_order >= 0),
  constraint menu_categories_id_restaurant_unique unique (id, restaurant_id),
  constraint menu_categories_name_unique unique (restaurant_id, name)
);

create index menu_categories_restaurant_sort_idx
  on public.menu_categories (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- menu_items
-- price_tzs is an integer amount in Tanzanian shillings. Prices are copied into
-- order_items at order time; this row may change later without rewriting
-- history.
-- ---------------------------------------------------------------------------
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null,
  name text not null,
  description text,
  price_tzs bigint not null,
  image_url text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_name_length check (char_length(name) between 1 and 120),
  constraint menu_items_description_length check (
    description is null or char_length(description) <= 2000
  ),
  constraint menu_items_price_non_negative check (price_tzs >= 0),
  constraint menu_items_sort_order_non_negative check (sort_order >= 0),
  constraint menu_items_id_restaurant_unique unique (id, restaurant_id),
  -- Category must belong to the same restaurant.
  constraint menu_items_category_fk foreign key (category_id, restaurant_id)
    references public.menu_categories (id, restaurant_id) on delete restrict
);

create index menu_items_restaurant_category_idx
  on public.menu_items (restaurant_id, category_id, sort_order);

create index menu_items_restaurant_available_idx
  on public.menu_items (restaurant_id, is_available);

-- ---------------------------------------------------------------------------
-- table_sessions
-- One occupancy session per table. A customer scan creates it as 'pending';
-- a waiter or restaurant admin activates it; staff close it when the table is
-- cleared.
-- ---------------------------------------------------------------------------
create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null,
  status public.table_session_status not null default 'pending',
  party_size integer,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_sessions_party_size_range check (
    party_size is null or party_size between 1 and 50
  ),
  constraint table_sessions_table_fk foreign key (table_id, restaurant_id)
    references public.restaurant_tables (id, restaurant_id) on delete cascade,
  constraint table_sessions_id_restaurant_unique unique (id, restaurant_id),
  -- Approved and closed sessions must have been approved.
  constraint table_sessions_approval_recorded check (
    status = 'pending' or approved_at is not null
  ),
  constraint table_sessions_close_recorded check (
    status <> 'closed' or closed_at is not null
  ),
  constraint table_sessions_approval_order check (
    approved_at is null or approved_at >= requested_at
  )
);

-- At most one open (pending or active) session per table. A second concurrent
-- scan cannot create a duplicate occupancy session.
create unique index table_sessions_one_open_per_table_idx
  on public.table_sessions (table_id)
  where status in ('pending', 'active');

create index table_sessions_restaurant_status_idx
  on public.table_sessions (restaurant_id, status, requested_at desc);

comment on table public.table_sessions is
  'Table occupancy. Created pending by guest scan, activated and closed by staff.';

-- ---------------------------------------------------------------------------
-- guest_sessions
-- One row per customer device participating in a table session. Created by
-- public.request_table_session(); multiple guests can join an active session.
-- ---------------------------------------------------------------------------
create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_session_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint guest_sessions_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 60
  ),
  constraint guest_sessions_table_session_fk foreign key (table_session_id, restaurant_id)
    references public.table_sessions (id, restaurant_id) on delete cascade,
  constraint guest_sessions_unique_per_user unique (table_session_id, user_id),
  -- Used by orders to prove the guest belongs to the same table session.
  constraint guest_sessions_id_table_session_unique unique (id, table_session_id)
);

create index guest_sessions_user_idx on public.guest_sessions (user_id);
create index guest_sessions_table_session_idx on public.guest_sessions (table_session_id);

comment on table public.guest_sessions is
  'Per-device participation in a table session. A guest may join a session without a new approval.';

commit;
