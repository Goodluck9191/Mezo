-- =============================================================================
-- Mezo — 04. Orders, order items, order events, waiter requests
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- orders
-- Payment state is never stored here; it lives in public.payments. Money is
-- integer TZS. Totals are recomputed by trigger from order_items so the
-- client can never set them.
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_session_id uuid not null,
  guest_session_id uuid not null,
  order_number bigint generated always as identity,
  status public.order_status not null default 'placed',
  subtotal_tzs bigint not null default 0,
  total_tzs bigint not null default 0,
  notes text,
  placed_by uuid references public.profiles (id) on delete set null,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_amounts_non_negative check (subtotal_tzs >= 0 and total_tzs >= 0),
  constraint orders_total_covers_subtotal check (total_tzs >= subtotal_tzs),
  constraint orders_notes_length check (notes is null or char_length(notes) <= 500),
  -- Composite key lets children prove restaurant ownership.
  constraint orders_id_restaurant_unique unique (id, restaurant_id),
  constraint orders_table_session_fk foreign key (table_session_id, restaurant_id)
    references public.table_sessions (id, restaurant_id) on delete cascade,
  -- The guest session must belong to the same table session.
  constraint orders_guest_session_fk foreign key (guest_session_id, table_session_id)
    references public.guest_sessions (id, table_session_id) on delete cascade
);

create index orders_restaurant_status_idx
  on public.orders (restaurant_id, status, created_at desc);

create index orders_table_session_idx on public.orders (table_session_id, created_at);
create index orders_guest_session_idx on public.orders (guest_session_id);
create index orders_placed_by_idx on public.orders (placed_by);

comment on table public.orders is
  'Order lifecycle. Payment status is tracked separately in public.payments.';

-- ---------------------------------------------------------------------------
-- order_items
-- Snapshots are written by a trigger from menu_items. The client never gets
-- to set name or price. subtotal_tzs is a generated column.
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name_snapshot text not null,
  unit_price_tzs bigint not null,
  quantity integer not null,
  options jsonb not null default '[]'::jsonb,
  subtotal_tzs bigint generated always as (unit_price_tzs * quantity) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_quantity_range check (quantity between 1 and 99),
  constraint order_items_price_non_negative check (unit_price_tzs >= 0),
  constraint order_items_options_array check (jsonb_typeof(options) = 'array'),
  constraint order_items_name_length check (char_length(name_snapshot) between 1 and 120),
  constraint order_items_notes_length check (notes is null or char_length(notes) <= 500),
  constraint order_items_order_fk foreign key (order_id, restaurant_id)
    references public.orders (id, restaurant_id) on delete cascade
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_restaurant_idx on public.order_items (restaurant_id);
create index order_items_menu_item_idx on public.order_items (menu_item_id);

comment on table public.order_items is
  'Lines with immutable snapshots of name, unit price, quantity and options.';

-- ---------------------------------------------------------------------------
-- order_events
-- Append-only audit trail of status changes, written only by triggers.
-- ---------------------------------------------------------------------------
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  event_type public.order_event_type not null,
  from_status public.order_status,
  to_status public.order_status,
  actor_user_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint order_events_status_change_only check (
    event_type <> 'status_changed'
    or (from_status is not null and to_status is not null)
  ),
  constraint order_events_order_fk foreign key (order_id, restaurant_id)
    references public.orders (id, restaurant_id) on delete cascade
);

create index order_events_order_id_idx on public.order_events (order_id, created_at);
create index order_events_restaurant_id_idx on public.order_events (restaurant_id, created_at desc);

comment on table public.order_events is
  'Append-only record of order lifecycle changes. Clients cannot insert or update.';

-- ---------------------------------------------------------------------------
-- waiter_requests
-- Guests ask for assistance or the bill. Enforced by staff; guests can only
-- create them, staff can move them through open -> acknowledged -> resolved.
-- ---------------------------------------------------------------------------
create table public.waiter_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  table_session_id uuid not null,
  guest_session_id uuid references public.guest_sessions (id) on delete set null,
  request_type public.waiter_request_type not null default 'assistance',
  status public.waiter_request_status not null default 'open',
  note text,
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waiter_requests_note_length check (note is null or char_length(note) <= 500),
  constraint waiter_requests_table_session_fk foreign key (table_session_id, restaurant_id)
    references public.table_sessions (id, restaurant_id) on delete cascade
);

create index waiter_requests_restaurant_status_idx
  on public.waiter_requests (restaurant_id, status, created_at)
  where status in ('open', 'acknowledged');

create index waiter_requests_table_session_idx
  on public.waiter_requests (table_session_id, created_at);

comment on table public.waiter_requests is
  'Assistance or bill requests from a guest in a table session.';

commit;
