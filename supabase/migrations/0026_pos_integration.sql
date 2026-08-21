-- ============================================================================
-- MenuFlow — POS (kassa) inteqrasiyası, ilk provayder: Poster POS
-- ============================================================================
-- PROBLEM. MenuFlow hazırda tam qapalı sistemdir: restoran menyusunu Admin
-- panelində əl ilə doldurur, kassir isə QR-dan gələn sifarişi öz POS
-- sistemində əl ilə YENİDƏN yazır. Bu, real restoranda qəbulun qarşısındakı
-- ən böyük praktiki maneədir.
--
-- Bu migrasiya iki istiqamətli sinxronizasiya üçün altyapını qurur:
--   * POS → MenuFlow: menyu/qiymət Poster-dən çəkilir (admin "İndi
--     sinxronla" düyməsi ilə, pos-poster-menu-sync Edge Function-u).
--   * MenuFlow → POS: sifariş verilən kimi Poster-ə ötürülür (bu faylın 5-ci
--     bölməsindəki trigger, pos-poster-order-push Edge Function-unu çağırır).
--
-- ARXİTEKTUR QƏRARI — pos_integrations cədvəli sıfır RLS policy, sıfır
-- client grant ilə: bu cədvəl canlı üçüncü-tərəf sirri (api_token) saxlayır.
-- Yeganə giriş yolları (a) aşağıdakı SECURITY DEFINER RPC-lər, (b) Edge
-- Function-ların service-role client-i. PostgREST üzərindən bu cədvələ heç
-- vaxt birbaşa çıxış yoxdur — get_public_restaurant()/get_table_orders()-in
-- "geniş policy əvəzinə dar funksiya" prinsipinin bir addım irəlisi: burada
-- hətta SELECT policy də yoxdur.
--
-- Digər POS provayderləri (iiko, Jowi) üçün tikiş `provider` sütunu və
-- Edge Function-ların _shared/poster.ts adapter formasıdır — indi YALNIZ
-- Poster qurulur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extension
-- ----------------------------------------------------------------------------
-- pg_net asinxron HTTP çağırışları üçün (bölmə 5-dəki trigger). Sinxron
-- `http` extension-u yox, məhz bu seçilib: sorğunu növbəyə qoyur və dərhal
-- qayıdır, ona görə Poster-in cavab gecikməsi/sıradan çıxması sifariş
-- INSERT-ini heç vaxt bloklamır.
create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- 1. categories/products — Poster ID uyğunlaşdırması üçün sütun
-- ----------------------------------------------------------------------------
-- MenuFlow-da əl ilə yaradılan hər sətir üçün null qalır — yalnız
-- pos-poster-menu-sync tərəfindən yaradılan/uyğunlaşdırılan sətirlər dolur.
-- Təkrar sinxronun idempotent olması üçün lazımdır: hər "Sinxronla"
-- klikində dublikat yaratmaq əvəzinə Poster-in öz ID-si ilə uyğunlaşdırır.
alter table public.categories add column if not exists pos_external_id text;
alter table public.products add column if not exists pos_external_id text;

comment on column public.categories.pos_external_id is
  'Poster kateqoriya ID-si — yalnız pos-poster-menu-sync doldurur, əl ilə yaradılan sətirlərdə null';
comment on column public.products.pos_external_id is
  'Poster məhsul ID-si — yalnız pos-poster-menu-sync doldurur, əl ilə yaradılan sətirlərdə null';

-- Qismən (partial) unikal indeks: yalnız Poster-dən gələn (null olmayan)
-- sətirləri restoran daxilində unikal edir, əksəriyyəti təşkil edən əl ilə
-- yaradılan (null) sətirlərə heç bir məhdudiyyət qoymur.
create unique index if not exists categories_pos_external_id_uidx
  on public.categories (restaurant_id, pos_external_id) where pos_external_id is not null;
create unique index if not exists products_pos_external_id_uidx
  on public.products (restaurant_id, pos_external_id) where pos_external_id is not null;

-- ----------------------------------------------------------------------------
-- 2. pos_integrations — restoran başına POS kredensialları/vəziyyəti
-- ----------------------------------------------------------------------------
create table if not exists public.pos_integrations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  provider text not null default 'poster' check (provider in ('poster')),
  account_identifier text,
  -- Poster access token. Bu sütun heç vaxt PostgREST-dən oxunmur (aşağıdakı
  -- revoke) və heç bir RPC nəticəsində geri qaytarılmır (bax: bölmə 4).
  api_token text,
  sync_menu_enabled boolean not null default true,
  sync_orders_enabled boolean not null default true,
  menu_sync_status text not null default 'never' check (menu_sync_status in ('never', 'success', 'error')),
  menu_sync_error text,
  menu_synced_at timestamptz,
  order_push_status text not null default 'never' check (order_push_status in ('never', 'success', 'error')),
  order_push_error text,
  order_push_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

comment on table public.pos_integrations is
  'Restoran başına POS kredensialları/sinxron vəziyyəti. Sıfır RLS policy, sıfır client grant — yalnız SECURITY DEFINER RPC-lər və Edge Function-ların service-role client-i çata bilər.';

drop trigger if exists pos_integrations_touch_updated_at on public.pos_integrations;
create trigger pos_integrations_touch_updated_at
  before update on public.pos_integrations
  for each row execute procedure public.touch_updated_at();

alter table public.pos_integrations enable row level security;
-- Qəsdən SIFIR policy. RLS aktivdir (default-deny), amma heç bir "for
-- authenticated using (...)" əlavə edilmir — beləliklə hətta öz
-- restoranının admini də PostgREST üzərindən bu cədvələ birbaşa çata
-- bilməz, yalnız aşağıdakı RPC-lər vasitəsilə.
revoke all on public.pos_integrations from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. is_admin_of() — is_staff_of()-un `staff` xaric edilmiş versiyası
-- ----------------------------------------------------------------------------
-- is_staff_of() qəsdən `staff`-ı da daxil edir (sifariş/hesab əməliyyatları
-- üçün), amma POS kredensialları ofisiant üçün heç vaxt əlçatan olmamalıdır
-- — yalnız restoran admini və super admin.
create or replace function public.is_admin_of(target_restaurant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or coalesce(
      (select role = 'restaurant_admin' and restaurant_id = target_restaurant_id
       from public.profiles where id = auth.uid()),
      false
    );
$$;

revoke all on function public.is_admin_of(uuid) from public, anon;
grant execute on function public.is_admin_of(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC-lər — pos_integrations-a yeganə giriş yolu
-- ----------------------------------------------------------------------------

-- upsert_pos_credentials — kredensialları yaradır/yeniləyir. p_api_token
-- opsionaldır: null/boş ötürülərsə mövcud token saxlanılır, belə ki, admin
-- token-i yenidən yazmadan yalnız toggle-ları dəyişə bilsin (client-in
-- token-i heç vaxt geri almadığı üçün "yenidən göndər" imkanı yoxdur).
-- Nəticədə token HEÇ VAXT qaytarılmır.
create or replace function public.upsert_pos_credentials(
  p_restaurant_id uuid,
  p_account_identifier text default null,
  p_api_token text default null,
  p_sync_menu_enabled boolean default null,
  p_sync_orders_enabled boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.pos_integrations;
begin
  if p_restaurant_id is null then
    raise exception 'Restoran tələb olunur.' using errcode = 'P0001';
  end if;
  if not public.is_admin_of(p_restaurant_id) then
    raise exception 'Bu əməliyyat üçün səlahiyyətiniz yoxdur.' using errcode = 'P0001';
  end if;

  insert into public.pos_integrations (restaurant_id, provider, account_identifier, api_token, sync_menu_enabled, sync_orders_enabled)
  values (
    p_restaurant_id, 'poster',
    p_account_identifier,
    nullif(p_api_token, ''),
    coalesce(p_sync_menu_enabled, true),
    coalesce(p_sync_orders_enabled, true)
  )
  on conflict (restaurant_id, provider) do update set
    account_identifier = coalesce(p_account_identifier, public.pos_integrations.account_identifier),
    api_token = coalesce(nullif(p_api_token, ''), public.pos_integrations.api_token),
    sync_menu_enabled = coalesce(p_sync_menu_enabled, public.pos_integrations.sync_menu_enabled),
    sync_orders_enabled = coalesce(p_sync_orders_enabled, public.pos_integrations.sync_orders_enabled)
  returning * into v_row;

  return jsonb_build_object(
    'restaurant_id', v_row.restaurant_id,
    'provider', v_row.provider,
    'account_identifier', v_row.account_identifier,
    'has_token', v_row.api_token is not null,
    'sync_menu_enabled', v_row.sync_menu_enabled,
    'sync_orders_enabled', v_row.sync_orders_enabled
  );
end;
$fn$;

revoke all on function public.upsert_pos_credentials(uuid, text, text, boolean, boolean) from public, anon;
grant execute on function public.upsert_pos_credentials(uuid, text, text, boolean, boolean) to authenticated;

-- disconnect_pos_integration — açıq niyyət bildirən ayrıca funksiya
-- (upsert-i "boş sətir" semantikası ilə yükləmək əvəzinə), settle_table_
-- payment-in p_paid boolean-ı ilə eyni "explicit action" prinsipi.
create or replace function public.disconnect_pos_integration(p_restaurant_id uuid)
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

  update public.pos_integrations
  set account_identifier = null,
      api_token = null,
      sync_menu_enabled = false,
      sync_orders_enabled = false
  where restaurant_id = p_restaurant_id and provider = 'poster';

  return jsonb_build_object('disconnected', true);
end;
$fn$;

revoke all on function public.disconnect_pos_integration(uuid) from public, anon;
grant execute on function public.disconnect_pos_integration(uuid) to authenticated;

-- get_pos_integration_status — api_token İSTİSNA olmaqla hər şeyi qaytarır,
-- üstəgəl has_token boolean. get_table_orders()/get_public_restaurant() ilə
-- eyni "geniş SELECT əvəzinə açıq sütun siyahılı funksiya" texnikası.
create or replace function public.get_pos_integration_status(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $fn$
declare
  v_row public.pos_integrations;
begin
  if p_restaurant_id is null then
    raise exception 'Restoran tələb olunur.' using errcode = 'P0001';
  end if;
  if not public.is_admin_of(p_restaurant_id) then
    raise exception 'Bu əməliyyat üçün səlahiyyətiniz yoxdur.' using errcode = 'P0001';
  end if;

  select * into v_row from public.pos_integrations
  where restaurant_id = p_restaurant_id and provider = 'poster';

  if not found then
    return jsonb_build_object(
      'restaurant_id', p_restaurant_id, 'provider', 'poster',
      'account_identifier', null, 'has_token', false,
      'sync_menu_enabled', false, 'sync_orders_enabled', false,
      'menu_sync_status', 'never', 'menu_sync_error', null, 'menu_synced_at', null,
      'order_push_status', 'never', 'order_push_error', null, 'order_push_synced_at', null
    );
  end if;

  return jsonb_build_object(
    'restaurant_id', v_row.restaurant_id,
    'provider', v_row.provider,
    'account_identifier', v_row.account_identifier,
    'has_token', v_row.api_token is not null,
    'sync_menu_enabled', v_row.sync_menu_enabled,
    'sync_orders_enabled', v_row.sync_orders_enabled,
    'menu_sync_status', v_row.menu_sync_status,
    'menu_sync_error', v_row.menu_sync_error,
    'menu_synced_at', v_row.menu_synced_at,
    'order_push_status', v_row.order_push_status,
    'order_push_error', v_row.order_push_error,
    'order_push_synced_at', v_row.order_push_synced_at
  );
end;
$fn$;

revoke all on function public.get_pos_integration_status(uuid) from public, anon;
grant execute on function public.get_pos_integration_status(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. push_order_to_pos() — sifariş verilən kimi Poster-ə ötürmə trigger-i
-- ----------------------------------------------------------------------------
-- KRİTİK XÜSUSİYYƏT: bu funksiya HEÇ VAXT exception atmamalıdır — Poster
-- sıradan çıxsa/konfiqurasiya səhv olsa belə, sifariş verilməsi bloklanmaz.
-- Hər erkən-çıxış yolu sükutla `return new` edir.
create or replace function public.push_order_to_pos()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_enabled boolean;
  v_secret text;
begin
  select sync_orders_enabled into v_enabled
  from public.pos_integrations
  where restaurant_id = new.restaurant_id and provider = 'poster';

  if not coalesce(v_enabled, false) then
    return new; -- inteqrasiya qurulmayıb/sönülüdür — səssiz no-op
  end if;

  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'pos_order_push_secret';
  exception when others then
    return new; -- vault hələ provisioning olunmayıb — heç vaxt bloklama
  end;

  if v_secret is null then
    return new;
  end if;

  -- Layihənin tək Supabase layihəsinə hardcode edilir (project_id
  -- evdlcbfsvvtrrmxxbzpr) — bu kod bazası çoxlu mühit/environment
  -- abstraksiyası daşımır (bax: supabaseService.js-in özü də URL-i
  -- NEXT_PUBLIC_SUPABASE_URL-dən oxuyur, DB tərəfində isə belə bir env
  -- oxuma mexanizmi yoxdur).
  perform net.http_post(
    url := 'https://evdlcbfsvvtrrmxxbzpr.supabase.co/functions/v1/pos-poster-order-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pos-push-secret', v_secret),
    body := jsonb_build_object('order_id', new.id, 'restaurant_id', new.restaurant_id)
  );

  return new;
exception when others then
  -- Son müdafiə xətti: yuxarıdakı hər addım öz-özünə fail-open olsa da,
  -- pg_net-in özündəki gözlənilməz bir xəta belə sifariş INSERT-ini
  -- batırmamalıdır.
  return new;
end;
$fn$;

drop trigger if exists orders_push_to_pos on public.orders;
create trigger orders_push_to_pos
  after insert on public.orders
  for each row execute procedure public.push_order_to_pos();

-- ----------------------------------------------------------------------------
-- 6. Bir dəfəlik provisioning (bu migrasiyanın İCRA ETMƏDİYİ addımlar)
-- ----------------------------------------------------------------------------
-- Sirlər koddur deyil provisioning-dir — SUPABASE_SERVICE_ROLE_KEY-in
-- repo-da olmaması ilə eyni məntiq. apply_migration ilə tətbiq edildikdən
-- SONRA, execute_sql ilə bir dəfə əl ilə işlədilməlidir:
--
--   select vault.create_secret('<32+ bayt təsadüfi dəyər>', 'pos_order_push_secret', 'POS order push shared secret');
--
-- Eyni təsadüfi sirr dəyəri pos-poster-order-push Edge Function-una
-- POS_ORDER_PUSH_SECRET env dəyişəni kimi verilməlidir.
