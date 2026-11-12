-- =============================================================================
-- Mezo — 17. Subscription management: catalogue tiers, concurrency-safe limit,
--            and platform-admin lifecycle RPCs.
-- =============================================================================
-- Builds on Phase 2/3's subscription schema (subscription_plans,
-- restaurant_subscriptions, subscription_payments). No applied migration is
-- edited; this file only ADDS and REPLACE-defines functions.
--
--   1. Adds the missing catalogue tiers Business / Enterprise (placeholder
--      prices; no approved commercial terms exist yet).
--   2. enforce_table_limit() now takes a FOR UPDATE lock on the current
--      subscription row, so concurrent inserts cannot bypass the limit.
--   3. Platform-admin-only RPCs for plan management, plan assignment,
--      subscription lifecycle transitions, manual payment recording and a
--      sweep for overdue renewals. Every change is written to audit_logs.
--      restaurant_admin can never call these: they require is_platform_admin().
--
-- Billing model is unchanged: renews_on is informative; no charge is ever made
-- automatically. Snippe is the payment provider; this phase records manual or
-- operator-entered payments only. No recurring-billing claim is made or
-- implemented here.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 17.1 Catalogue: Business and Enterprise tiers (placeholders only)
-- ---------------------------------------------------------------------------
insert into public.subscription_plans (
  code, name, description, price_tzs, billing_interval, table_limit, is_active
)
values
  (
    'business_monthly',
    'Business',
    'Placeholder tier for growing restaurant groups. Up to 50 tables (placeholder limit). Pricing not approved; contact the platform.',
    0,
    'monthly',
    50,
    true
  ),
  (
    'enterprise_monthly',
    'Enterprise',
    'Custom arrangement. Price and table limits arranged with the platform. Contact sales; nothing is charged until an order is signed.',
    0,
    'monthly',
    10000,
    true
  )
on conflict (code) do nothing;

comment on column public.subscription_plans.price_tzs is
  'Integer TZS. All current prices are unapproved placeholders pending commercial review. 0 = custom pricing (contact the platform).';
comment on table public.subscription_plans is
  'Platform subscription catalogue. Prices are placeholders until commercial terms are approved. Publicly readable when active.';

-- ---------------------------------------------------------------------------
-- 17.2 Concurrency-safe table-limit enforcement
-- The previous version counted under READ COMMITTED; two concurrent inserts
-- could both pass. The subscription row is now locked FOR UPDATE, so table
-- inserts for the same restaurant serialize on it.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_table_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select s.table_limit into v_limit
  from public.restaurant_subscriptions s
  where s.restaurant_id = new.restaurant_id
    and s.status in ('pending', 'active', 'past_due')
  order by s.created_at desc
  limit 1
  for update of s;

  if v_limit is null then
    raise exception 'restaurant subscription is not active — renew your plan to add tables'
      using errcode = '23514';
  end if;

  select count(*) into v_count
  from public.restaurant_tables t
  where t.restaurant_id = new.restaurant_id;

  if v_count >= v_limit then
    raise exception 'table limit reached (% tables for this plan)', v_limit
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.enforce_table_limit() is
  'Rejects inserting a table once the restaurant has used its plan table_limit. Locks the subscription row FOR UPDATE so concurrent inserts serialize.';

-- ---------------------------------------------------------------------------
-- 17.3 create_subscription_plan(...) — platform admin only
-- ---------------------------------------------------------------------------
create or replace function public.create_subscription_plan(
  p_code text,
  p_name text,
  p_description text,
  p_price_tzs bigint,
  p_billing_interval public.billing_interval,
  p_table_limit integer,
  p_is_active boolean default true
)
returns public.subscription_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_plan public.subscription_plans;
  v_code text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  v_code := lower(btrim(coalesce(p_code, '')));

  if v_code !~ '^[a-z0-9_]{3,40}$' then
    raise exception 'plan code must be 3-40 lowercase letters, digits and underscores'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) < 2 or char_length(p_name) > 80 then
    raise exception 'plan name must be 2-80 characters' using errcode = '22023';
  end if;

  if p_price_tzs < 0 then
    raise exception 'price cannot be negative' using errcode = '22023';
  end if;

  if p_table_limit < 1 or p_table_limit > 10000 then
    raise exception 'table limit must be between 1 and 10000' using errcode = '22023';
  end if;

  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'description must be 1000 characters or fewer' using errcode = '22023';
  end if;

  insert into public.subscription_plans
    (code, name, description, price_tzs, billing_interval, table_limit, is_active)
  values
    (v_code, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
     p_price_tzs, p_billing_interval, p_table_limit, coalesce(p_is_active, true))
  returning * into v_plan;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, detail
  )
  values (
    v_actor, 'platform_admin', 'subscription_plan.created', 'subscription_plan', v_plan.id,
    jsonb_build_object('code', v_plan.code, 'table_limit', v_plan.table_limit, 'price_tzs', v_plan.price_tzs)
  );

  return v_plan;
end;
$$;

comment on function public.create_subscription_plan(text, text, text, bigint, public.billing_interval, integer, boolean) is
  'Platform admin only. Creates a subscription plan in the catalogue.';

-- ---------------------------------------------------------------------------
-- 17.4 update_subscription_plan(...) — platform admin only
-- Code is immutable; the plan's new limit applies only to future subscriptions.
-- ---------------------------------------------------------------------------
create or replace function public.update_subscription_plan(
  p_plan_id uuid,
  p_name text,
  p_description text,
  p_price_tzs bigint,
  p_billing_interval public.billing_interval,
  p_table_limit integer
)
returns public.subscription_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.subscription_plans;
  v_plan public.subscription_plans;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  select * into v_old from public.subscription_plans where id = p_plan_id for update;

  if not found then
    raise exception 'subscription plan not found' using errcode = 'P0002';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) < 2 or char_length(p_name) > 80 then
    raise exception 'plan name must be 2-80 characters' using errcode = '22023';
  end if;

  if p_price_tzs < 0 then
    raise exception 'price cannot be negative' using errcode = '22023';
  end if;

  if p_table_limit < 1 or p_table_limit > 10000 then
    raise exception 'table limit must be between 1 and 10000' using errcode = '22023';
  end if;

  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'description must be 1000 characters or fewer' using errcode = '22023';
  end if;

  update public.subscription_plans
  set name = btrim(p_name),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      price_tzs = p_price_tzs,
      billing_interval = p_billing_interval,
      table_limit = p_table_limit
  where id = p_plan_id
  returning * into v_plan;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, detail
  )
  values (
    v_actor, 'platform_admin', 'subscription_plan.updated', 'subscription_plan', v_plan.id,
    jsonb_build_object(
      'code', v_plan.code,
      'old', jsonb_build_object('table_limit', v_old.table_limit, 'price_tzs', v_old.price_tzs, 'billing_interval', v_old.billing_interval),
      'new', jsonb_build_object('table_limit', v_plan.table_limit, 'price_tzs', v_plan.price_tzs, 'billing_interval', v_plan.billing_interval)
    )
  );

  return v_plan;
end;
$$;

comment on function public.update_subscription_plan(uuid, text, text, bigint, public.billing_interval, integer) is
  'Platform admin only. Updates a plan; the new table_limit applies from the next subscription assignment, never retroactively.';

-- ---------------------------------------------------------------------------
-- 17.5 set_subscription_plan_active(p_plan_id, p_is_active) — platform admin
-- ---------------------------------------------------------------------------
create or replace function public.set_subscription_plan_active(
  p_plan_id uuid,
  p_is_active boolean
)
returns public.subscription_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_plan public.subscription_plans;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  update public.subscription_plans
  set is_active = p_is_active
  where id = p_plan_id
  returning * into v_plan;

  if not found then
    raise exception 'subscription plan not found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, detail
  )
  values (
    v_actor, 'platform_admin',
    case when p_is_active then 'subscription_plan.reactivated' else 'subscription_plan.deactivated' end,
    'subscription_plan',
    v_plan.id,
    jsonb_build_object('code', v_plan.code, 'is_active', v_plan.is_active)
  );

  return v_plan;
end;
$$;

comment on function public.set_subscription_plan_active(uuid, boolean) is
  'Platform admin only. Activates or deactivates a plan in the catalogue.';

-- ---------------------------------------------------------------------------
-- 17.6 assign_subscription_plan(...) — platform admin only
-- Closes the restaurant's current term (status='cancelled') and opens a new
-- 'active' term on the chosen plan. table_limit is re-snapshotted from the
-- new plan via the existing trigger. Existing tables are never touched.
-- ---------------------------------------------------------------------------
create or replace function public.assign_subscription_plan(
  p_restaurant_id uuid,
  p_plan_id uuid,
  p_starts_on date default null,
  p_renews_on date default null
)
returns public.restaurant_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_plan public.subscription_plans;
  v_old public.restaurant_subscriptions;
  v_new public.restaurant_subscriptions;
  v_old_plan_code text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.restaurants r where r.id = p_restaurant_id) then
    raise exception 'restaurant not found' using errcode = 'P0002';
  end if;

  select * into v_plan from public.subscription_plans
  where id = p_plan_id and is_active;

  if not found then
    raise exception 'subscription plan is missing or inactive' using errcode = '23503';
  end if;

  select * into v_old from public.restaurant_subscriptions
  where restaurant_id = p_restaurant_id
    and status in ('pending', 'active', 'past_due')
  for update;

  if found then
    select p.code into v_old_plan_code
    from public.subscription_plans p
    where p.id = v_old.plan_id;

    update public.restaurant_subscriptions
    set status = 'cancelled', cancelled_at = now()
    where id = v_old.id;
  end if;

  insert into public.restaurant_subscriptions (
    restaurant_id, plan_id, status, table_limit, starts_on, renews_on
  )
  values (
    p_restaurant_id,
    p_plan_id,
    'active',
    v_plan.table_limit,
    coalesce(p_starts_on, current_date),
    coalesce(
      p_renews_on,
      coalesce(p_starts_on, current_date)
        + case when v_plan.billing_interval = 'yearly' then interval '1 year' else interval '1 month' end
    )
  )
  returning * into v_new;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_actor, 'platform_admin', p_restaurant_id, 'subscription.assign', 'restaurant_subscription', v_new.id,
    jsonb_strip_nulls(jsonb_build_object(
      'plan_code', v_plan.code,
      'previous_plan_code', v_old_plan_code,
      'table_limit', v_plan.table_limit,
      'starts_on', v_new.starts_on,
      'renews_on', v_new.renews_on
    ))
  );

  return v_new;
end;
$$;

comment on function public.assign_subscription_plan(uuid, uuid, date, date) is
  'Platform admin only. Closes the current term (status=cancelled) and opens an active term on the chosen plan for the restaurant.';

-- ---------------------------------------------------------------------------
-- 17.7 set_subscription_status(p_restaurant_id, p_status) — platform admin
-- Transition map (this is the full, enforced lifecycle):
--   pending  -> active | cancelled | expired
--   active   -> past_due | expired | cancelled
--   past_due -> active | expired | cancelled
--   expired  -> active | cancelled
--   cancelled -> (terminal, no transitions)
-- ---------------------------------------------------------------------------
create or replace function public.set_subscription_status(
  p_restaurant_id uuid,
  p_status public.subscription_status
)
returns public.restaurant_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_sub public.restaurant_subscriptions;
  v_previous_status public.subscription_status;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  if p_status = 'pending' then
    raise exception 'transition into pending is not allowed' using errcode = '22023';
  end if;

  select * into v_sub from public.restaurant_subscriptions
  where restaurant_id = p_restaurant_id
    and status in ('pending', 'active', 'past_due')
  order by created_at desc
  limit 1
  for update;

  if not found then
    -- Allow reviving the latest (even expired) row for expired -> active.
    select * into v_sub from public.restaurant_subscriptions
    where restaurant_id = p_restaurant_id
    order by created_at desc
    limit 1
    for update;
  end if;

  if not found then
    raise exception 'subscription not found for this restaurant' using errcode = 'P0002';
  end if;

  if p_status = v_sub.status then
    return v_sub;
  end if;

  if not (
    (v_sub.status = 'pending'  and p_status in ('active', 'cancelled', 'expired')) or
    (v_sub.status = 'active'   and p_status in ('past_due', 'expired', 'cancelled')) or
    (v_sub.status = 'past_due' and p_status in ('active', 'expired', 'cancelled')) or
    (v_sub.status = 'expired'  and p_status in ('active', 'cancelled'))
  ) then
    raise exception 'invalid transition from % to %', v_sub.status, p_status
      using errcode = '22023';
  end if;

  v_previous_status := v_sub.status;

  update public.restaurant_subscriptions
  set status = p_status,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
  where id = v_sub.id
  returning * into v_sub;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_actor, 'platform_admin', p_restaurant_id, 'subscription.status.' || p_status::text, 'restaurant_subscription', v_sub.id,
    jsonb_build_object('from', v_previous_status::text, 'to', p_status::text)
  );

  return v_sub;
end;
$$;

comment on function public.set_subscription_status(uuid, public.subscription_status) is
  'Platform admin only. Moves the current subscription through the allowed lifecycle: pending -> active|cancelled|expired; active -> past_due|expired|cancelled; past_due -> active|expired|cancelled; expired -> active|cancelled. cancelled is terminal.';

-- ---------------------------------------------------------------------------
-- 17.8 record_subscription_payment(...) — platform admin only
-- Idempotent on (provider, provider_reference): a retried call returns the
-- existing row with already_recorded = true instead of duplicating it.
-- Never derives success from a browser redirect: only the platform action
-- (or, later, a signature-verified webhook) enters records here.
-- ---------------------------------------------------------------------------
create or replace function public.record_subscription_payment(
  p_restaurant_id uuid,
  p_amount_tzs bigint,
  p_status public.payment_status default 'successful',
  p_provider_reference text default null,
  p_period_starts_on date default null,
  p_period_ends_on date default null,
  p_paid_at timestamptz default now(),
  p_failure_reason text default null
)
returns table (
  id uuid,
  restaurant_id uuid,
  restaurant_subscription_id uuid,
  status public.payment_status,
  amount_tzs bigint,
  provider public.payment_provider,
  provider_reference text,
  paid_at timestamptz,
  already_recorded boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_sub public.restaurant_subscriptions;
  v_payment public.subscription_payments;
  v_ref text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  if p_amount_tzs < 0 then
    raise exception 'amount cannot be negative' using errcode = '22023';
  end if;

  if p_period_starts_on is not null and p_period_ends_on is not null and p_period_ends_on < p_period_starts_on then
    raise exception 'period end must be on or after period start' using errcode = '22023';
  end if;

  v_ref := nullif(btrim(coalesce(p_provider_reference, '')), '');

  if v_ref is not null and exists (
    select 1 from public.subscription_payments p
    where p.provider = 'snippe' and p.provider_reference = v_ref
  ) then
    select * into v_payment
    from public.subscription_payments p
    where p.provider = 'snippe' and p.provider_reference = v_ref;

    return query
    select v_payment.id, v_payment.restaurant_id, v_payment.restaurant_subscription_id,
           v_payment.status, v_payment.amount_tzs, v_payment.provider,
           v_payment.provider_reference, v_payment.paid_at, true;
    return;
  end if;

  select * into v_sub from public.restaurant_subscriptions as s
  where s.restaurant_id = p_restaurant_id
    and s.status in ('pending', 'active', 'past_due')
  order by s.created_at desc
  limit 1;

  if not found then
    select * into v_sub from public.restaurant_subscriptions as s
    where s.restaurant_id = p_restaurant_id
    order by s.created_at desc
    limit 1;
  end if;

  if not found then
    raise exception 'subscription not found for this restaurant' using errcode = 'P0002';
  end if;

  insert into public.subscription_payments (
    restaurant_id, restaurant_subscription_id, status, amount_tzs,
    period_starts_on, period_ends_on, paid_at, provider_reference, failure_reason
  )
  values (
    p_restaurant_id, v_sub.id, p_status, p_amount_tzs,
    p_period_starts_on, p_period_ends_on,
    case when p_status = 'successful' then coalesce(p_paid_at, now()) else p_paid_at end,
    v_ref,
    nullif(btrim(coalesce(p_failure_reason, '')), '')
  )
  returning * into v_payment;

  insert into public.audit_logs (
    actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
  )
  values (
    v_actor, 'platform_admin', p_restaurant_id, 'subscription.payment.recorded', 'subscription_payment', v_payment.id,
    jsonb_strip_nulls(jsonb_build_object('amount_tzs', v_payment.amount_tzs, 'status', v_payment.status::text, 'provider_reference', v_payment.provider_reference))
  );

  return query
  select v_payment.id, v_payment.restaurant_id, v_payment.restaurant_subscription_id,
         v_payment.status, v_payment.amount_tzs, v_payment.provider,
         v_payment.provider_reference, v_payment.paid_at, false;
end;
$$;

comment on function public.record_subscription_payment(uuid, bigint, public.payment_status, text, date, date, timestamptz, text) is
  'Platform admin only. Records a subscription payment manually or from a verified source, idempotently on (provider, provider_reference).';

-- ---------------------------------------------------------------------------
-- 17.9 expire_overdue_subscriptions()
-- Marks active/past_due subscriptions whose renews_on has passed as expired.
-- Callable by the platform (or the service role during a future scheduled
-- job). Never moves cancelled/expired rows; never changes dates.
-- ---------------------------------------------------------------------------
create or replace function public.expire_overdue_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer := 0;
  v_row public.restaurant_subscriptions;
begin
  if v_actor is null then
    if current_user not in ('postgres', 'service_role') then
      raise exception 'authentication required' using errcode = '42501';
    end if;
  elsif not public.is_platform_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  for v_row in
    update public.restaurant_subscriptions
    set status = 'expired'
    where status in ('active', 'past_due')
      and renews_on is not null
      and renews_on < current_date
    returning *
  loop
    v_count := v_count + 1;
    insert into public.audit_logs (
      actor_user_id, actor_role, restaurant_id, action, entity_type, entity_id, detail
    )
    values (
      v_actor,
      case when v_actor is null then 'service' else 'platform_admin' end,
      v_row.restaurant_id,
      'subscription.status.expired',
      'restaurant_subscription',
      v_row.id,
      jsonb_build_object('renews_on', v_row.renews_on, 'reason', 'overdue renewal')
    );
  end loop;

  return v_count;
end;
$$;

comment on function public.expire_overdue_subscriptions() is
  'Platform admin or service role. Marks non-terminated subscriptions whose renews_on date has passed as expired.';

-- ---------------------------------------------------------------------------
-- 17.10 Privilages: authenticated may call the RPCs; authorization is inside.
-- ---------------------------------------------------------------------------
grant execute on function public.create_subscription_plan(text, text, text, bigint, public.billing_interval, integer, boolean) to authenticated;
grant execute on function public.update_subscription_plan(uuid, text, text, bigint, public.billing_interval, integer) to authenticated;
grant execute on function public.set_subscription_plan_active(uuid, boolean) to authenticated;
grant execute on function public.assign_subscription_plan(uuid, uuid, date, date) to authenticated;
grant execute on function public.set_subscription_status(uuid, public.subscription_status) to authenticated;
grant execute on function public.record_subscription_payment(uuid, bigint, public.payment_status, text, date, date, timestamptz, text) to authenticated;
grant execute on function public.expire_overdue_subscriptions() to authenticated, service_role;

commit;
