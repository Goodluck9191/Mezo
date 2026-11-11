-- =============================================================================
-- Mezo — development seed data
-- =============================================================================
-- Only the platform subscription catalogue. No fake accounts, no passwords, no
-- credentials. Safe to run on a fresh database.
--
-- Pricing is a placeholder set for development. Replace it once the commercial
-- terms are approved; do not invent a production price list.
-- =============================================================================

begin;

insert into public.subscription_plans (
  code, name, description, price_tzs, billing_interval, table_limit, is_active
)
values
  (
    'starter_monthly',
    'Starter',
    'For small dining rooms. Up to 5 tables, digital menu, QR ordering.',
    45000,
    'monthly',
    5,
    true
  ),
  (
    'growth_monthly',
    'Growth',
    'For busy restaurants. Up to 20 tables, waiter dashboard, kitchen board.',
    85000,
    'monthly',
    20,
    true
  ),
  (
    'pro_monthly',
    'Pro',
    'For multi-location operators. Up to 100 tables, priority support.',
    180000,
    'monthly',
    100,
    true
  ),
  (
    'starter_yearly',
    'Starter (yearly)',
    'Starter plan billed annually. Two months free.',
    450000,
    'yearly',
    5,
    true
  ),
  (
    'growth_yearly',
    'Growth (yearly)',
    'Growth plan billed annually. Two months free.',
    850000,
    'yearly',
    20,
    true
  )
on conflict (code) do nothing;

commit;
