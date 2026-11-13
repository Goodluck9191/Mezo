-- =============================================================================
-- Mezo — 18. Menu management: archive semantics + public menu RPC + menu-images
-- =============================================================================
-- Extends Phase 2/3's menu schema (menu_categories, menu_items) without
-- recreating or editing anything applied before:
--
--   1. menu_categories / menu_items gain `archived_at` (soft-delete).
--      Public visibility excludes archived rows. Restoring is a client call.
--   2. Broad DELETE privileges on those tables are revoked from client roles;
--      the ONLY deletion path left for clients is archive/restore. service_role
--      keeps full access (operational resets and migrations).
--   3. Public-read policies and helpers exclude archived rows.
--   4. New narrowly-scoped SDK for the public menu: get_public_menu(slug)
--      returns ONLY what an approved, active restaurant publishes for the
--      customer menu; called by anonymous users.
--   5. Storage bucket `menu-images` (2 MB, PNG/JPEG/WebP/AVIF, public read)
--      with restaurant_admin-only write into the restaurant's own folder.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 18.1 Soft-delete columns
-- ---------------------------------------------------------------------------
alter table public.menu_categories
  add column if not exists archived_at timestamptz;

alter table public.menu_items
  add column if not exists archived_at timestamptz;

create index if not exists menu_categories_restaurant_live_idx
  on public.menu_categories (restaurant_id, sort_order)
  where archived_at is null;

create index if not exists menu_items_restaurant_live_idx
  on public.menu_items (restaurant_id, category_id, sort_order)
  where archived_at is null;

comment on column public.menu_categories.archived_at is
  'Soft-delete timestamp. Non-null rows stay hidden from public menus and are hidden by default in the workspace; they are never removed (orders reference them).';
comment on column public.menu_items.archived_at is
  'Soft-delete timestamp. Non-null rows stay hidden from public menus and are hidden by default in the workspace; they are never removed (orders history references them).';

-- ---------------------------------------------------------------------------
-- 18.2 Stop client-side hard deletes for menu rows
-- ---------------------------------------------------------------------------
revoke delete on public.menu_categories from authenticated;
revoke delete on public.menu_items from authenticated;

-- Clients need to set/clear archived_at to archive/restore categories & items.
grant update (archived_at) on public.menu_categories to authenticated;
grant update (archived_at) on public.menu_items to authenticated;

-- ---------------------------------------------------------------------------
-- 18.3 Tighten public-read policies for archived rows
-- ---------------------------------------------------------------------------
drop policy menu_categories_public_select on public.menu_categories;
create policy menu_categories_public_select on public.menu_categories
  for select to anon, authenticated
  using (
    is_active
    and archived_at is null
    and public.is_restaurant_public(restaurant_id)
  );

drop policy menu_items_public_select on public.menu_items;
create policy menu_items_public_select on public.menu_items
  for select to anon, authenticated
  using (
    is_available
    and archived_at is null
    and public.is_category_public(category_id)
  );

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
      and c.archived_at is null
      and r.application_status = 'approved'
      and r.operational_status = 'active'
  );
$$;

comment on function public.is_category_public(uuid) is
  'True when the category is active, unarchived and its restaurant is publicly available.';

-- ---------------------------------------------------------------------------
-- 18.4 get_public_menu(p_slug)
-- The ONLY public read path for the customer menu. Returns flattened rows
-- already filtered to published data, approved+active restaurants only.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_menu(p_slug text)
returns table (
  restaurant_id uuid,
  restaurant_name text,
  restaurant_slug text,
  restaurant_description text,
  restaurant_logo_url text,
  restaurant_contact_phone text,
  restaurant_address_line1 text,
  restaurant_address_line2 text,
  restaurant_city text,
  restaurant_region text,
  restaurant_country_code char(2),
  category_id uuid,
  category_name text,
  category_description text,
  category_sort_order integer,
  item_id uuid,
  item_name text,
  item_description text,
  price_tzs bigint,
  item_image_url text,
  is_available boolean,
  item_sort_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.name,
    r.slug,
    r.description,
    r.logo_url,
    r.contact_phone,
    r.address_line1,
    r.address_line2,
    r.city,
    r.region,
    r.country_code,
    c.id,
    c.name,
    c.description,
    c.sort_order,
    i.id,
    i.name,
    i.description,
    i.price_tzs,
    i.image_url,
    i.is_available,
    i.sort_order
  from public.restaurants r
  join public.menu_categories c
    on c.restaurant_id = r.id
  join public.menu_items i
    on i.category_id = c.id
  where r.slug = lower(btrim(p_slug))
    and r.application_status = 'approved'
    and r.operational_status = 'active'
    and c.is_active
    and c.archived_at is null
    and i.archived_at is null
  order by c.sort_order, i.sort_order, i.name;
$$;

comment on function public.get_public_menu(text) is
  'Narrowly scoped public read for the customer menu. Returns only published rows approved-and-active restaurants; anonymous-safe.';

revoke all on function public.get_public_menu(text) from public, anon, authenticated;
grant execute on function public.get_public_menu(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 18.5 Storage: menu-images bucket (public read, restaurant_admin write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

create policy menu_images_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'menu-images');

create policy menu_images_admin_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'menu-images'
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
    bucket_id = 'menu-images'
    and exists (
      select 1
      from public.restaurant_members m
      where m.user_id = auth.uid()
        and m.is_active
        and m.role = 'restaurant_admin'
        and m.restaurant_id = (string_to_array(name, '/'))[1]::uuid
    )
  );

commit;
