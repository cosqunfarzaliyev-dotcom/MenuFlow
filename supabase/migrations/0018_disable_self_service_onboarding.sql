-- ============================================================================
-- MenuFlow — Disable self-service restaurant onboarding (super-admin-only model)
-- ============================================================================
-- Master Plan decision D1 ("Yol A"): admin accounts are NOT publicly
-- self-serviceable. A public sign-up still creates a *login* (an `unassigned`
-- profile via the on_auth_user_created trigger), but becoming a
-- `restaurant_admin` now requires a super admin to create the restaurant and
-- assign the user to it (SuperAdmin → Restaurants → assign by email, which
-- calls assignUserToRestaurant / superAdminService).
--
-- Until now, create_restaurant_self_service() (0003, revised through 0016) was
-- `grant execute ... to authenticated`, letting any signed-in `unassigned`
-- user create their own restaurant and self-promote to restaurant_admin from
-- /onboarding. This migration closes that path by REVOKING execute on the
-- function. The function body is intentionally left in place (not dropped) so
-- the change is minimal and trivially reversible — a later phase that wants a
-- gated invite flow can re-grant or wrap it. With execute revoked, any
-- remaining client call (the deprecated billingService.createRestaurantSelfService
-- wrapper) fails closed with "permission denied for function" rather than
-- silently creating a tenant.
--
-- This is the only behavioural change: no table, column, policy, trigger, or
-- other grant is touched. Existing restaurants and their trials are unaffected
-- (this only removes the *new* self-serve creation path). Additive and safe on
-- the current empty database.
--
-- The app side that pairs with this migration:
--   - app/onboarding/page.jsx no longer renders a creation form; it shows an
--     "account pending super-admin activation" screen for unassigned users.
--   - lib/services/billingService.js createRestaurantSelfService is marked
--     deprecated (no live caller).
--
-- Run this after 0017_fix_product_and_order_schema.sql.
-- ============================================================================

-- Revoke from every grantee the function was ever granted to. `if exists`
-- keeps this idempotent and re-runnable even if a grant was already removed.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_restaurant_self_service'
  ) then
    revoke execute on function public.create_restaurant_self_service(text, text, text, text, int)
      from authenticated, anon, public;
  end if;
end $$;
