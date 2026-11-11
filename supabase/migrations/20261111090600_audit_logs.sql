-- =============================================================================
-- Mezo — 07. Audit logs (append-only)
-- =============================================================================
-- Written by SECURITY DEFINER functions (application review, lifecycle
-- changes). No client can insert, update or delete. Platform admins can read.
-- Deliberately has no updated_at: rows are immutable.
-- =============================================================================

begin;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_length check (char_length(action) between 3 and 120),
  constraint audit_logs_entity_type_length check (char_length(entity_type) between 3 and 60),
  constraint audit_logs_actor_role_length check (
    actor_role is null or char_length(actor_role) <= 40
  ),
  constraint audit_logs_detail_object check (jsonb_typeof(detail) = 'object')
);

create index audit_logs_restaurant_created_idx
  on public.audit_logs (restaurant_id, created_at desc);

create index audit_logs_actor_created_idx
  on public.audit_logs (actor_user_id, created_at desc);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

comment on table public.audit_logs is
  'Immutable audit trail. Insert via SECURITY DEFINER functions only.';

commit;
