-- =============================================================================
-- Mezo — 12. Authenticated read access to the public catalogue view
-- =============================================================================
-- public.public_restaurants exposes only the 11 safe, approved-and-active
-- columns (id, name, slug, description, logo_url, contact_phone, address_line1,
-- address_line2, city, region, country_code). It already grants SELECT to anon;
-- authenticated received none, which breaks the Phase 3 guest flow where an
-- anonymous customer is issued an *authenticated* token by Supabase anonymous
-- sign-ins. The same columns/rows are now available to both client roles.
-- =============================================================================

begin;

grant select on public.public_restaurants to authenticated;

commit;
