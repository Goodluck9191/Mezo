-- =============================================================================
-- Mezo — 01. Enumerated types and shared utilities
-- =============================================================================
-- Keep these values in sync with src/lib/security/roles.ts and the
-- application's TypeScript unions. Adding a value later must be a new
-- migration; never edit an applied migration.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------

-- Restaurant lifecycle review. Only platform admins may change this.
create type public.application_status as enum ('pending', 'approved', 'rejected');

-- Whether a restaurant may take orders right now.
create type public.operational_status as enum ('active', 'suspended');

-- Cached summary of the current subscription. The authoritative row lives in
-- public.restaurant_subscriptions.
create type public.subscription_status as enum (
  'pending',
  'active',
  'past_due',
  'cancelled',
  'expired'
);

-- Roles a user can hold *inside* a restaurant. Platform administrators are
-- intentionally not part of this enum; they live in public.platform_admins.
create type public.restaurant_role as enum ('restaurant_admin', 'waiter', 'kitchen');

-- Occupancy lifecycle for a restaurant table.
--   pending -> active -> closed
create type public.table_session_status as enum ('pending', 'active', 'closed');

create type public.order_status as enum (
  'placed',
  'accepted',
  'preparing',
  'ready',
  'served',
  'cancelled'
);

create type public.order_event_type as enum ('created', 'status_changed', 'note', 'cancelled');

create type public.waiter_request_type as enum ('assistance', 'bill', 'other');

create type public.waiter_request_status as enum ('open', 'acknowledged', 'resolved', 'cancelled');

-- Payment state is deliberately separate from order state.
create type public.payment_status as enum (
  'pending',
  'processing',
  'successful',
  'failed',
  'cancelled',
  'refunded'
);

create type public.payment_provider as enum ('snippe');

create type public.payment_attempt_status as enum (
  'initiated',
  'pending',
  'successful',
  'failed',
  'cancelled'
);

create type public.payment_webhook_status as enum ('received', 'processed', 'failed', 'ignored');

create type public.billing_interval as enum ('monthly', 'yearly');

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger that keeps updated_at accurate. Attached to every mutable table.';

commit;
