-- ============================================================================
-- MenuFlow — Billing fields + self-service restaurant signup
-- ============================================================================
-- Run this after 0001_multi_tenant_saas.sql and 0002_security_hardening.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Billing / trial state on each restaurant
-- ----------------------------------------------------------------------------
alter table public.restaurants add column if not exists plan text not null default 'trial';
alter table public.restaurants add column if not exists subscription_status text not null default 'trialing'
  check (subscription_status in ('trialing', 'active', 'past_due', 'canceled'));
alter table public.restaurants add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days');

-- ----------------------------------------------------------------------------
-- 2. SECURITY FIX: the original profiles_self_update policy (0001) let a
--    signed-in user UPDATE their *own* profiles row with no column
--    restriction — including `role` and `restaurant_id`. That means any
--    authenticated user could open the browser console and run:
--        supabase.from('profiles').update({ role: 'super_admin' }).eq('id', myId)
--    and grant themselves platform-owner access. Only a super_admin (or the
--    security-definer signup function below) should ever be able to change
--    role/restaurant_id.
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_super_admin_update" on public.profiles
  for update to authenticated using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 3. Self-service restaurant signup
-- ----------------------------------------------------------------------------
-- A newly signed-up user (role = 'unassigned', no restaurant yet) can create
-- their own restaurant and become its restaurant_admin, starting a trial —
-- no super_admin action required. This runs as SECURITY DEFINER so it can
-- write to restaurants/profiles/restaurant_tables despite RLS, but it
-- enforces its own rules: caller must be logged in, and can't already own a
-- restaurant (prevents one account silently taking over multiple tenants
-- through this path — a super_admin can still assign additional ones
-- manually if that's ever needed).
create or replace function public.create_restaurant_self_service(
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
  caller_restaurant_id uuid;
  new_restaurant public.restaurants;
  safe_table_count int := greatest(1, least(200, coalesce(p_table_count, 20)));
begin
  if caller_id is null then
    raise exception 'Bu əməliyyat üçün daxil olmusunuz olmalısınız.' using errcode = 'P0001';
  end if;

  select restaurant_id into caller_restaurant_id from public.profiles where id = caller_id;
  if caller_restaurant_id is not null then
    raise exception 'Bu hesab artıq bir restorana bağlıdır.' using errcode = 'P0001';
  end if;

  insert into public.restaurants (slug, name, tagline, currency_symbol, table_count, is_active, plan, subscription_status, trial_ends_at)
  values (p_slug, p_name, coalesce(p_tagline, ''), coalesce(p_currency_symbol, '₼'), safe_table_count, true, 'trial', 'trialing', now() + interval '14 days')
  returning * into new_restaurant;

  insert into public.restaurant_tables (restaurant_id, table_number, name)
  select new_restaurant.id, i, 'Masa ' || i
  from generate_series(1, safe_table_count) as i;

  update public.profiles
  set role = 'restaurant_admin', restaurant_id = new_restaurant.id
  where id = caller_id;

  return new_restaurant;
exception
  when unique_violation then
    raise exception 'Bu slug artıq istifadə olunur, başqa bir ad seçin.' using errcode = 'P0001';
end;
$$;

grant execute on function public.create_restaurant_self_service(text, text, text, text, int) to authenticated;
