-- ============================================================================
-- MenuFlow — Epoint onlayn ödəniş inteqrasiyası (masa hesabının onlayn ödənişi)
-- ============================================================================
-- PROBLEM. 0025_order_payment_status.sql-dən bəri "ödəniş" həmişə NİYYƏT idi:
-- müştəri cash/card/Google Pay/Apple Pay seçir, bu seçim staff-a 'bill' tipli
-- alert kimi göndərilir, faktiki ödənişi isə YALNIZ işçi settle_table_payment()
-- ilə təsdiqləyir (lib/services/paymentService.js-in öz şərhi: "no payment-
-- processor backend or keys configured"). Real pul heç vaxt bu axından
-- keçmirdi.
--
-- Bu migrasiya ilk real ödəniş relsini qurur: Epoint (epoint.az, Azərbaycan
-- bank kartı ödəniş şlüzü). Yalnız masa-hesabı axını (CustomerApp.jsx-in
-- "Hesabı ödə" modalı) — sifariş göndərmə zamanı DEYİL, çünki orada hələ
-- yekun məbləğ yoxdur və tam səhifə yönləndirməsi sifariş göndərilməsini
-- yarımçıq qoyardı.
--
-- PROTOKOL — rafoabbas/epoint-woocommerce-9.x.x-in real mənbə kodundan
-- (təxmin deyil, faktiki oxunub) doğrulanıb:
--   POST https://epoint.az/api/1/payment-request
--     body: data=base64(json{public_key,amount,currency,language,order_id,
--           description,success_redirect_url,error_redirect_url})
--          &signature=base64(sha1(private_key + data + private_key, RAW))
--     cavab: sadə JSON {status:'success', redirect_url}
--   Epoint müştərini geri success/error_redirect_url-ə YÖNLƏNDİRİR
--   (?order_id=<bizim order_id> ilə) — bu yönləndirmə NƏTİCƏNİ bildirmir,
--   sadəcə "müştəri geri qayıtdı" deməkdir.
--   POST https://epoint.az/api/1/get-status
--     body: data=base64(json{public_key, transaction: <bizim order_id>})
--          &signature = eyni düstur
--     cavab: {status:'success'|'new'|...} — HƏQİQİ nəticə buradan gəlir.
--
-- Ona görə bu, inbound webhook DEYİL: MenuFlow-un öz server tərəfi (Edge
-- Function) yönləndirmədən sonra get-status-u ÖZÜ sorğulayır. Bu, imzalı
-- inbound POST doğrulama sxemi uydurmaq riskini tamamilə aradan qaldırır —
-- həqiqət mənbəyi bizim öz HTTPS sorğumuzun cavabıdır.
--
-- ARXİTEKTUR QƏRARI — pos_integrations (0026) ilə EYNİ naxış: restoran
-- başına sirr öz cədvəlində, sıfır RLS, yalnız SECURITY DEFINER RPC-lər
-- (admin kredensial idarəsi üçün) və Edge Function-ların service-role
-- client-i (faktiki ödəniş çağırışları üçün) çata bilər.
--
-- PLAN QAPISI YOXDUR (istifadəçi ilə qərarlaşdırılıb): POS_INTEGRATION-dan
-- fərqli olaraq Epoint FEATURES/entitlement sisteminə bağlanmır — restoranın
-- öz Epoint merchant hesabını qoşub aktivləşdirməsi kifayətdir, POS-un öz
-- Poster tokenini tələb etməsi ilə eyni təbii məhdudiyyət.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. payment_integrations — restoran başına Epoint kredensialları
-- ----------------------------------------------------------------------------
create table if not exists public.payment_integrations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  provider text not null default 'epoint' check (provider in ('epoint')),
  -- Epoint-in "public_key"-i sirr deyil (Stripe-ın publishable key-i kimi) —
  -- amma private_key ilə eyni cədvəldə saxlanılır, çünki hər ikisi eyni
  -- inteqrasiya sətrinə aiddir və heç biri PostgREST üzərindən oxunmur.
  public_key text,
  private_key text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

comment on table public.payment_integrations is
  'Restoran başına Epoint kredensialları. Sıfır RLS policy, sıfır client grant — yalnız SECURITY DEFINER RPC-lər (admin idarəsi) və Edge Function-ların service-role client-i (epoint-create-payment/epoint-confirm-payment) çata bilər.';

drop trigger if exists payment_integrations_touch_updated_at on public.payment_integrations;
create trigger payment_integrations_touch_updated_at
  before update on public.payment_integrations
  for each row execute procedure public.touch_updated_at();

alter table public.payment_integrations enable row level security;
revoke all on public.payment_integrations from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. payment_transactions — hər Epoint ödəniş cəhdi üçün bir sətir
-- ----------------------------------------------------------------------------
-- id sütunu birbaşa Epoint-ə göndərilən order_id-dir (get-status sorğusunda
-- "transaction" kimi geri göndərilir) — ayrıca uyğunlaşdırma sütunu lazım
-- deyil. Client-in bu cədvələ birbaşa çıxışı yoxdur (nəticəni
-- epoint-confirm-payment-in cavabından və orders.payment_status-un
-- get_table_orders() vasitəsilə yenidən oxunmasından öyrənir).
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.restaurant_tables (id) on delete cascade,
  amount numeric not null,
  currency text not null default 'AZN',
  status text not null default 'pending' check (status in ('pending', 'success', 'error')),
  epoint_status text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payment_transactions is
  'Hər Epoint checkout cəhdi. id = Epoint-ə göndərilən order_id. Sıfır RLS, sıfır client grant — yalnız epoint-create-payment/epoint-confirm-payment Edge Function-larının service-role client-i yazır.';

create index if not exists payment_transactions_restaurant_table_idx
  on public.payment_transactions (restaurant_id, table_id);

drop trigger if exists payment_transactions_touch_updated_at on public.payment_transactions;
create trigger payment_transactions_touch_updated_at
  before update on public.payment_transactions
  for each row execute procedure public.touch_updated_at();

alter table public.payment_transactions enable row level security;
revoke all on public.payment_transactions from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. RPC-lər — payment_integrations-a yeganə admin giriş yolu
-- ----------------------------------------------------------------------------
-- is_admin_of() artıq 0026_pos_integration.sql-dən mövcuddur — eyni "yalnız
-- restaurant_admin/super_admin, staff yox" qapısı yenidən istifadə olunur.

-- upsert_payment_credentials — p_private_key opsionaldır: null/boş
-- ötürülərsə mövcud dəyər saxlanılır (upsert_pos_credentials ilə eyni
-- "yalnız toggle dəyişəndə token itməsin" məntiqi). private_key HEÇ VAXT
-- qaytarılmır.
create or replace function public.upsert_payment_credentials(
  p_restaurant_id uuid,
  p_public_key text default null,
  p_private_key text default null,
  p_enabled boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.payment_integrations;
begin
  if p_restaurant_id is null then
    raise exception 'Restoran tələb olunur.' using errcode = 'P0001';
  end if;
  if not public.is_admin_of(p_restaurant_id) then
    raise exception 'Bu əməliyyat üçün səlahiyyətiniz yoxdur.' using errcode = 'P0001';
  end if;

  insert into public.payment_integrations (restaurant_id, provider, public_key, private_key, enabled)
  values (
    p_restaurant_id, 'epoint',
    nullif(p_public_key, ''),
    nullif(p_private_key, ''),
    coalesce(p_enabled, false)
  )
  on conflict (restaurant_id, provider) do update set
    public_key = coalesce(nullif(p_public_key, ''), public.payment_integrations.public_key),
    private_key = coalesce(nullif(p_private_key, ''), public.payment_integrations.private_key),
    enabled = coalesce(p_enabled, public.payment_integrations.enabled)
  returning * into v_row;

  return jsonb_build_object(
    'restaurant_id', v_row.restaurant_id,
    'provider', v_row.provider,
    'public_key', v_row.public_key,
    'has_private_key', v_row.private_key is not null,
    'enabled', v_row.enabled
  );
end;
$fn$;

revoke all on function public.upsert_payment_credentials(uuid, text, text, boolean) from public, anon;
grant execute on function public.upsert_payment_credentials(uuid, text, text, boolean) to authenticated;

-- disconnect_payment_integration — disconnect_pos_integration ilə eyni
-- "açıq niyyət" prinsipi.
create or replace function public.disconnect_payment_integration(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_restaurant_id is null then
    raise exception 'Restoran tələb olunur.' using errcode = 'P0001';
  end if;
  if not public.is_admin_of(p_restaurant_id) then
    raise exception 'Bu əməliyyat üçün səlahiyyətiniz yoxdur.' using errcode = 'P0001';
  end if;

  update public.payment_integrations
  set public_key = null,
      private_key = null,
      enabled = false
  where restaurant_id = p_restaurant_id and provider = 'epoint';

  return jsonb_build_object('disconnected', true);
end;
$fn$;

revoke all on function public.disconnect_payment_integration(uuid) from public, anon;
grant execute on function public.disconnect_payment_integration(uuid) to authenticated;

-- get_payment_integration_status — private_key İSTİSNA olmaqla hər şeyi
-- qaytarır, üstəgəl has_private_key boolean. public_key sirr deyil (yuxarı
-- bax), admin formunda geri göstərilə bilər.
create or replace function public.get_payment_integration_status(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $fn$
declare
  v_row public.payment_integrations;
begin
  if p_restaurant_id is null then
    raise exception 'Restoran tələb olunur.' using errcode = 'P0001';
  end if;
  if not public.is_admin_of(p_restaurant_id) then
    raise exception 'Bu əməliyyat üçün səlahiyyətiniz yoxdur.' using errcode = 'P0001';
  end if;

  select * into v_row from public.payment_integrations
  where restaurant_id = p_restaurant_id and provider = 'epoint';

  if not found then
    return jsonb_build_object(
      'restaurant_id', p_restaurant_id, 'provider', 'epoint',
      'public_key', null, 'has_private_key', false, 'enabled', false
    );
  end if;

  return jsonb_build_object(
    'restaurant_id', v_row.restaurant_id,
    'provider', v_row.provider,
    'public_key', v_row.public_key,
    'has_private_key', v_row.private_key is not null,
    'enabled', v_row.enabled
  );
end;
$fn$;

revoke all on function public.get_payment_integration_status(uuid) from public, anon;
grant execute on function public.get_payment_integration_status(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. get_public_restaurant() — epoint_payment_enabled sütunu əlavə olunur
-- ----------------------------------------------------------------------------
-- Müştəri menyusu anonimdir və restaurants-ı birbaşa oxumur (bax: 0020) —
-- yalnız bu funksiyanın qaytardığı dar siyahını görür. Sütun buraya əlavə
-- edilməsə, admin Epoint-i qoşub aktivləşdirsə belə, "Hesabı ödə" modalında
-- Epoint düyməsi HEÇ VAXT görünməyəcək (0044/0045-in eyni səbəbi).
--
-- Diqqət: bu, indiki canlı funksiyanın (0045_restaurant_service_model.sql-in
-- yazdığı, service_model sütunlu versiya) üzərinə qurulur, ARXİV olan
-- 0044-ün pay_later_enabled-li versiyası üzərinə YOX — 0045 həmin sütunu
-- artıq silib. pg_get_functiondef ilə canlı tərifə qarşı yoxlanılıb.
drop function if exists public.get_public_restaurant(text);

create function public.get_public_restaurant(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  logo text,
  logo_display_mode text,
  tagline text,
  currency_symbol text,
  table_count int,
  theme_primary_color text,
  theme_secondary_color text,
  theme_background_color text,
  theme_surface_color text,
  feature_flags jsonb,
  service_model text,
  epoint_payment_enabled boolean,
  is_active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id, r.slug, r.name, r.logo, r.logo_display_mode, r.tagline, r.currency_symbol,
    r.table_count, r.theme_primary_color, r.theme_secondary_color,
    r.theme_background_color, r.theme_surface_color,
    r.feature_flags, r.service_model,
    coalesce(pi.enabled and pi.public_key is not null and pi.private_key is not null, false)
      as epoint_payment_enabled,
    r.is_active, r.created_at
  from public.restaurants r
  left join public.payment_integrations pi
    on pi.restaurant_id = r.id and pi.provider = 'epoint'
  where r.slug = p_slug and r.is_active = true;
$$;

grant execute on function public.get_public_restaurant(text) to anon, authenticated;
