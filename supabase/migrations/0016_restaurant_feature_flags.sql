-- ============================================================================
-- 0016_restaurant_feature_flags.sql
-- ============================================================================
-- Per-restaurant feature switches (Apple Pay / Google Pay / Banner reklamları
-- üçün) SuperAdmin panelindən idarə olunur. restaurant_admin bunları özü
-- dəyişə bilməməlidir — mövcud protect_restaurant_privileged_fields()
-- trigger-inə əlavə olunur (0006_admin_feature_pack.sql-də yaradılıb).
--
-- Bundan əlavə, create_restaurant_self_service() RPC-də sınaq müddəti də
-- 7 günə endirilir (əvvəllər 14 gün idi, TRIAL_LENGTH_DAYS ilə uyğunlaşdırılır).
-- ============================================================================

alter table public.restaurants
  add column if not exists feature_flags jsonb not null default
    '{"apple_pay": true, "google_pay": true, "banners": true}'::jsonb;

-- Extend the existing privileged-fields guard to also protect feature_flags.
create or replace function public.protect_restaurant_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    new.slug := old.slug;
    new.plan := old.plan;
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
    new.is_active := old.is_active;
    new.feature_flags := old.feature_flags;
  end if;
  return new;
end;
$$;

-- Align the self-service signup trial length with the SuperAdmin-created
-- flow (both are now 7 days — see lib/services/billingService.js
-- TRIAL_LENGTH_DAYS). Only the interval literal changes; everything else in
-- the function is unchanged from 0014_slug_server_side_validation.sql.
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
  clean_slug text;
begin
  if caller_id is null then
    raise exception 'Bu əməliyyat üçün daxil olmusunuz olmalısınız.' using errcode = 'P0001';
  end if;

  select restaurant_id into caller_restaurant_id from public.profiles where id = caller_id;
  if caller_restaurant_id is not null then
    raise exception 'Bu hesab artıq bir restorana bağlıdır.' using errcode = 'P0001';
  end if;

  clean_slug := lower(regexp_replace(trim(coalesce(p_slug, '')), '[^a-z0-9-]+', '-', 'g'));
  clean_slug := trim(both '-' from clean_slug);
  if clean_slug = '' or length(clean_slug) > 60 then
    raise exception 'Etibarlı bir slug daxil edin (yalnız hərf, rəqəm, tire; maks. 60 simvol).' using errcode = 'P0001';
  end if;
  if length(coalesce(p_name, '')) = 0 or length(p_name) > 120 then
    raise exception 'Etibarlı bir restoran adı daxil edin.' using errcode = 'P0001';
  end if;

  insert into public.restaurants (slug, name, tagline, currency_symbol, table_count, is_active, plan, subscription_status, trial_ends_at, feature_flags)
  values (clean_slug, p_name, coalesce(p_tagline, ''), coalesce(p_currency_symbol, '₼'), safe_table_count, true, 'basic', 'trialing', now() + interval '7 days', '{"apple_pay": false, "google_pay": false, "banners": false}'::jsonb)
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
