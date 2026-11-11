-- =============================================================================
-- Mezo — 06. Subscription plans, subscriptions, subscription payments
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- subscription_plans
-- Platform-wide catalogue. Priced in integer TZS. table_limit is snapshotted
-- onto restaurant_subscriptions at subscribe time and enforced by trigger.
-- ---------------------------------------------------------------------------
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_tzs bigint not null,
  billing_interval public.billing_interval not null default 'monthly',
  table_limit integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plans_code_format check (code ~ '^[a-z0-9_]{3,40}$'),
  constraint subscription_plans_name_length check (char_length(name) between 2 and 80),
  constraint subscription_plans_price_non_negative check (price_tzs >= 0),
  constraint subscription_plans_table_limit_range check (table_limit between 1 and 10000),
  constraint subscription_plans_description_length check (
    description is null or char_length(description) <= 1000
  )
);

comment on table public.subscription_plans is
  'Platform subscription catalogue. Publicly readable when active.';

-- ---------------------------------------------------------------------------
-- restaurant_subscriptions
-- One current subscription per restaurant (enforced by partial unique index).
-- table_limit is a snapshot of the plan; changing the plan re-snapshots it.
-- No assumption of automatic recurring payment: the renewal date is stored,
-- and the platform moves the restaurant to past_due/expired manually or by a
-- scheduled server job.
-- ---------------------------------------------------------------------------
create table public.restaurant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id) on delete restrict,
  status public.subscription_status not null default 'pending',
  table_limit integer not null,
  starts_on date not null default current_date,
  renews_on date,
  expires_on date,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_subscriptions_expiry_order check (
    expires_on is null or expires_on >= starts_on
  ),
  constraint restaurant_subscriptions_renewal_order check (
    renews_on is null or renews_on >= starts_on
  ),
  constraint restaurant_subscriptions_table_limit_range check (table_limit between 1 and 10000),
  -- Composite key for children.
  constraint restaurant_subscriptions_id_restaurant_unique unique (id, restaurant_id)
);

-- At most one subscription that is not terminated per restaurant.
create unique index restaurant_subscriptions_one_current_idx
  on public.restaurant_subscriptions (restaurant_id)
  where status in ('pending', 'active', 'past_due');

create index restaurant_subscriptions_plan_idx on public.restaurant_subscriptions (plan_id);
create index restaurant_subscriptions_status_renewal_idx
  on public.restaurant_subscriptions (status, renews_on);

comment on table public.restaurant_subscriptions is
  'Current and historical subscriptions. table_limit is snapshotted from the plan.';

-- ---------------------------------------------------------------------------
-- subscription_payments
-- Ledger of subscription invoices/payments. Prepared for manual or automated
-- collection; no recurring billing is implemented in this phase.
-- ---------------------------------------------------------------------------
create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  restaurant_subscription_id uuid not null,
  status public.payment_status not null default 'pending',
  amount_tzs bigint not null,
  currency text not null default 'TZS',
  provider public.payment_provider not null default 'snippe',
  provider_reference text,
  provider_checkout_url text,
  period_starts_on date,
  period_ends_on date,
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_payments_amount_non_negative check (amount_tzs >= 0),
  constraint subscription_payments_currency_tzs check (currency = 'TZS'),
  constraint subscription_payments_provider_reference_unique unique (
    provider, provider_reference
  ),
  constraint subscription_payments_paid_at_required check (
    status <> 'successful' or paid_at is not null
  ),
  constraint subscription_payments_period_order check (
    period_ends_on is null
    or period_starts_on is null
    or period_ends_on >= period_starts_on
  ),
  constraint subscription_payments_failure_reason_length check (
    failure_reason is null or char_length(failure_reason) <= 500
  ),
  constraint subscription_payments_subscription_fk foreign key (
    restaurant_subscription_id, restaurant_id
  ) references public.restaurant_subscriptions (id, restaurant_id) on delete cascade
);

create index subscription_payments_subscription_idx
  on public.subscription_payments (restaurant_subscription_id, created_at desc);

create index subscription_payments_restaurant_status_idx
  on public.subscription_payments (restaurant_id, status, created_at desc);

comment on table public.subscription_payments is
  'Ledger of subscription payments. Append-only from a client perspective.';

commit;
