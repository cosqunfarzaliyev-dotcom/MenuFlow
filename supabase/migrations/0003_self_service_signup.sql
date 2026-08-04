-- ============================================================================
-- MenuFlow — Self-service signup + subscription/trial model
-- ============================================================================
-- Adds a lightweight subscription model to restaurants (plan, status, trial
-- end date) and a SECURITY DEFINER function that lets a signed-up user
-- create their own restaurant and become its restaurant_admin — without
-- needing a super_admin to do it for them.
--
-- There's no real payment gateway wired in yet (that needs API keys this
-- migration can't have). What this DOES give you:
--   - New signups get a 14-day trial automatically.
--   - /superadmin lets you flip a restaurant's subscription_status to
--     'active' by hand once you've been paid (bank transfer, invoice, etc.)
--     — a manual-reconciliation workflow, which is a completely normal way
--     to run a SaaS before a payment gateway is wired in.
--   - fetchRestaurantBySlug (customer menu) and the admin panel both check
--     subscription_status/trial_ends_at, so an expired trial actually stops
--     serving the menu instead of just being a cosmetic label.
--
-- Run this after 0001_multi_tenant_saas.sql and 0002_security_hardening.sql.
-- ============================================================================

alter table public.restaurants add column if not exists plan text not null default 'trial';
alter table public.restaurants add column if not exists subscription_status text not null default 'trialing'
  check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled'));
alter table public.restaurants add column if not exists trial_ends_at timestamptz default (now() + interval '14 days');
alter table public.restaurants add column if not exists owner_email text;

-- Restaurants created directly by a super_admin (via /superadmin) are
-- assumed to be manually-managed paying customers, not self-service trials.
alter table public.restaurants alter column plan set default 'trial';

-- ----------------------------------------------------------------------------
-- Self-service restaurant creation
-- ----------------------------------------------------------------------------
-- Runs as SECURITY DEFINER (same pattern as handle_new_user in migration
-- 0001) so it can insert into restaurants/profiles/restaurant_tables in one
-- atomic step regardless of the caller's own RLS grants. It still enforces
-- its own authorization: only a signed-in user with no restaurant yet may
-- call it, and only for themselves.
create or replace function public.create_my_restaurant(
  p_slug text,
  p_name text,
  p_tagline text default '',
  p_currency_symbol text default '₼',
  p_table_count int default 20
)
returns public.restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  caller_restaurant_id uuid;
  new_restaurant public.restaurants;
  clean_slug text;
  safe_table_count int;
begin
  if caller_id is null then
    raise exception 'Bu əməliyyat üçün daxil olmalısınız.' using errcode = 'P0001';
  end if;

  select restaurant_id, email into caller_restaurant_id, caller_email
  from public.profiles where id = caller_id;

  if caller_restaurant_id is not null then
    raise exception 'Bu hesab artıq bir restorana bağlıdır.' using errcode = 'P0001';
  end if;

  clean_slug := lower(regexp_replace(trim(p_slug), '[^a-zA-Z0-9-]+', '-', 'g'));
  if clean_slug = '' or clean_slug is null then
    raise exception 'Etibarlı bir slug daxil edin.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.restaurants where slug = clean_slug) then
    raise exception 'Bu slug artıq istifadə olunur, başqasını seçin.' using errcode = 'P0001';
  end if;

  safe_table_count := greatest(1, least(200, coalesce(p_table_count, 20)));

  insert into public.restaurants (slug, name, tagline, currency_symbol, table_count, is_active, plan, subscription_status, trial_ends_at, owner_email)
  values (clean_slug, coalesce(nullif(trim(p_name), ''), 'MenuFlow'), coalesce(p_tagline, ''), coalesce(nullif(p_currency_symbol, ''), '₼'), safe_table_count, true, 'trial', 'trialing', now() + interval '14 days', caller_email)
  returning * into new_restaurant;

  update public.profiles set role = 'restaurant_admin', restaurant_id = new_restaurant.id where id = caller_id;

  insert into public.restaurant_tables (restaurant_id, table_number, name)
  select new_restaurant.id, gs, 'Masa ' || gs
  from generate_series(1, safe_table_count) as gs;

  return new_restaurant;
end;
$$;

grant execute on function public.create_my_restaurant(text, text, text, text, int) to authenticated;

-- ----------------------------------------------------------------------------
-- POST-MIGRATION: restaurants you create yourself via /superadmin should
-- usually be marked as paying customers immediately rather than "trial",
-- since you're onboarding them directly:
--
--   update public.restaurants set plan = 'manual', subscription_status = 'active'
--   where slug = 'the-slug-you-created';
--
-- (The /superadmin UI also has a toggle for this now — see updateRestaurant
-- in lib/services/superAdminService.js.)
-- ============================================================================
