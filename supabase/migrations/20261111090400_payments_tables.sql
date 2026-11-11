-- =============================================================================
-- Mezo — 05. Payments
-- =============================================================================
-- Prepared for a Snippe Payments integration. No payment processing is
-- implemented here. API keys must NEVER be stored in these tables: they belong
-- in server-only environment variables (SUPABASE_SERVICE_ROLE_KEY, SNIPPE_*),
-- never in the database. webhook_payload is restricted to platform admins.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- payments
-- One payment per attempt to collect for a table session (the bill). The
-- provider never writes directly; the server creates rows and updates status
-- after verifying the webhook.
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_session_id uuid not null,
  provider public.payment_provider not null default 'snippe',
  status public.payment_status not null default 'pending',
  amount_tzs bigint not null,
  currency text not null default 'TZS',
  provider_reference text,
  provider_checkout_url text,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_non_negative check (amount_tzs >= 0),
  constraint payments_currency_tzs check (currency = 'TZS'),
  constraint payments_failure_reason_length check (
    failure_reason is null or char_length(failure_reason) <= 500
  ),
  constraint payments_provider_reference_unique unique (provider, provider_reference),
  -- A successful payment must record when.
  constraint payments_paid_at_required check (status <> 'successful' or paid_at is not null),
  constraint payments_id_restaurant_unique unique (id, restaurant_id),
  constraint payments_table_session_fk foreign key (table_session_id, restaurant_id)
    references public.table_sessions (id, restaurant_id) on delete cascade
);

create index payments_restaurant_status_idx
  on public.payments (restaurant_id, status, created_at desc);

create index payments_table_session_idx on public.payments (table_session_id);

comment on table public.payments is
  'Bill collection. No API keys. Provider references are safe to store.';

-- ---------------------------------------------------------------------------
-- payment_attempts
-- Each call to the provider is an attempt. A payment may have several
-- attempts. Stores provider status, not secrets.
-- ---------------------------------------------------------------------------
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  payment_id uuid not null,
  status public.payment_attempt_status not null default 'initiated',
  amount_tzs bigint not null,
  currency text not null default 'TZS',
  provider_reference text,
  provider_status text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_amount_non_negative check (amount_tzs >= 0),
  constraint payment_attempts_currency_tzs check (currency = 'TZS'),
  constraint payment_attempts_provider_reference_unique unique (provider_reference),
  constraint payment_attempts_error_message_length check (
    error_message is null or char_length(error_message) <= 500
  ),
  constraint payment_attempts_payment_fk foreign key (payment_id, restaurant_id)
    references public.payments (id, restaurant_id) on delete cascade
);

create index payment_attempts_payment_idx
  on public.payment_attempts (payment_id, created_at desc);

create index payment_attempts_restaurant_status_idx
  on public.payment_attempts (restaurant_id, status, created_at desc);

comment on table public.payment_attempts is
  'One row per call to the payment provider.';

-- ---------------------------------------------------------------------------
-- payment_webhook_events
-- Idempotency + forensics for provider webhooks. Signatures MUST be verified
-- by the server before a row is marked processed. Payload is retained to
-- investigate disputes and is restricted to platform admins (may contain PII).
-- ---------------------------------------------------------------------------
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  event_id text not null unique,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  status public.payment_webhook_status not null default 'received',
  signature_verified boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_webhook_events_provider_event_unique unique (provider, event_id),
  constraint payment_webhook_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint payment_webhook_events_error_length check (
    error_message is null or char_length(error_message) <= 500
  ),
  constraint payment_webhook_events_processed check (
    status <> 'processed' or processed_at is not null
  )
);

create index payment_webhook_events_payment_idx on public.payment_webhook_events (payment_id);
create index payment_webhook_events_restaurant_idx on public.payment_webhook_events (restaurant_id);
create index payment_webhook_events_status_received_idx
  on public.payment_webhook_events (status, received_at);

comment on table public.payment_webhook_events is
  'Raw webhook log for idempotent processing. Restricted to platform admins.';

commit;
