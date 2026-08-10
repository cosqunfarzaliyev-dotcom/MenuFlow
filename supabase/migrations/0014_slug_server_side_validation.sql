-- ============================================================================
-- MenuFlow — Server-side slug validation for self-service restaurant signup
-- ============================================================================
-- Run this after 0003_billing_self_service.sql.
-- ============================================================================

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

  insert into public.restaurants (slug, name, tagline, currency_symbol, table_count, is_active, plan, subscription_status, trial_ends_at)
  values (clean_slug, p_name, coalesce(p_tagline, ''), coalesce(p_currency_symbol, '₼'), safe_table_count, true, 'trial', 'trialing', now() + interval '14 days')
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
