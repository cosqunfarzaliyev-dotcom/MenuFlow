-- ============================================================================
-- MenuFlow — ödəniş vəziyyəti (payment_status), sifariş statusundan ayrılmış
-- ============================================================================
-- PROBLEM 1 — ödəniş yalnız "niyyət" idi, heç vaxt "fakt" deyildi.
-- 0010 orders-a payment_method əlavə etdi, amma o, sifariş VERİLƏRKƏN seçilən
-- üsuldur. Ödənişin baş verib-vermədiyini saxlayan heç bir sütun yox idi.
-- Nəticədə:
--   * müştəri yeməyini bitirib sonra ödəyə bilmirdi — sistemdə bunu ifadə
--     edən vəziyyət yox idi;
--   * AdminApp-ın TablesManagement bölməsi masa statusunu yalnız sifariş
--     statusundan çıxardığı üçün XİDMƏT OLUNMUŞ, LAKİN ÖDƏNİLMƏMİŞ masa
--     "boş" görünürdü — birbaşa pul itkisi riski;
--   * ödənişin bitdiyini bildirən yeganə siqnal işçinin `bill` alert-ini
--     "həll edildi" işarələməsi idi; bu, alerts sətrinə yazılır, sifarişə
--     yox, və heç bir məbləğ saxlamır.
--
-- payment_status `status` sütununa ORTOQONALDIR: sifariş eyni anda həm
-- 'served', həm 'unpaid' ola bilər. Ona görə mövcud status dəyərlərinə yeni
-- bir dəyər əlavə etmək YANLIŞ olardı — ayrı sütun lazımdır.
--
-- PROBLEM 2 — anonim müştəri öz sifarişini oxuya bilmirdi.
-- pg_policies-ə görə orders-da cəmi 3 siyasət var və hər üçü {authenticated}
-- + is_staff_of(). Yəni anon SELECT ümumiyyətlə qadağandır: CustomerApp-ın
-- "Aktiv Sifarişlərim" bölməsi real müştəri üçün HƏMİŞƏ boş qayıdırdı (RLS
-- xəta vermir, sadəcə sıfır sətir süzür) və billTotal həmişə 0 idi — wallet
-- ödənişi 0 məbləğlə açılırdı. Ödənilməmiş hesabı müştəriyə göstərmək üçün
-- bu bağlanmalıdır; aşağıdakı get_table_orders() bunu 0020-nin
-- get_public_restaurant() üçün qurduğu naxışla edir: geniş siyasət yox, açıq
-- sütun siyahılı SECURITY DEFINER funksiya.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Sütunlar
-- ----------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid references auth.users (id) on delete set null;

-- 0010 payment_method-u qəsdən check-siz saxladı (dəyər dəsti genişlənə
-- bilərdi). Burada isə dəyər dəsti dar və qapalıdır — səhv dəyər sükutla
-- keçib hesabatı korlamamalıdır.
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'paid'));

comment on column public.orders.payment_status is
  'unpaid | paid — sifariş statusundan (status) asılı deyil; served+unpaid mümkündür';
comment on column public.orders.paid_by is
  'Ödənişi təsdiqləyən işçi (auth.uid()), settle_table_payment() tərəfindən server tərəfdə yazılır';

-- Ödənilməmiş sifarişlər hər masa görünüşündə sorğulanır; qismən indeks
-- ödənilmiş (zamanla böyüyən) hissəni indeksdən tam kənarda saxlayır.
create index if not exists orders_unpaid_idx
  on public.orders (restaurant_id, table_id)
  where payment_status = 'unpaid';

-- Backfill: köhnə modeldə xidmət olunmuş sifariş ödənilmiş sayılırdı. Bunsuz
-- bütün tarixi sifarişlər birdən "ödənilməmiş" kimi görünərdi.
update public.orders
set payment_status = 'paid',
    paid_at = coalesce(paid_at, created_at)
where status = 'served'
  and payment_status = 'unpaid';

-- ----------------------------------------------------------------------------
-- 2. settle_table_payment() — masanın hesabını bağlayır (işçi əməliyyatı)
-- ----------------------------------------------------------------------------
-- Masa üzrədir, sifariş üzrə deyil: müştəri axşam ərzində bir neçə sifariş
-- verib sonda bir dəfə ödəyir. N sifariş sətri + bill alert bir tranzaksiyada
-- atomik dəyişməlidir, ona görə bu, client-dəki ardıcıl UPDATE-lərlə deyil,
-- RPC ilə edilir.
--
-- TƏHLÜKƏSİZLİK: SECURITY DEFINER RLS-i bypass edir, ona görə funksiya öz
-- avtorizasiyasını ÖZÜ aparır — bu, layihənin sənədləşmiş qaydasıdır
-- (upsert_alert() QR token-i, update_my_locale() auth.uid()-i özü yenidən
-- çıxarır). Çağıranın kimliyi yalnız auth.uid()-dən götürülür; parametr kimi
-- ötürülən heç bir istifadəçi id-sinə etibar edilmir.
create or replace function public.settle_table_payment(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_payment_method text default null,
  p_payment_method_label text default null,
  p_paid boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count int := 0;
  v_total numeric := 0;
begin
  if p_restaurant_id is null or p_table_id is null then
    raise exception 'Restoran və masa tələb olunur.' using errcode = 'P0001';
  end if;

  -- Əsas qapı. is_staff_of() super_admin-i də əhatə edir və eyni restorana
  -- bağlı olmayan işçini rədd edir — tenant izolyasiyası burada qorunur.
  if not public.is_staff_of(p_restaurant_id) then
    raise exception 'Bu əməliyyat üçün səlahiyyətiniz yoxdur.' using errcode = 'P0001';
  end if;

  if p_paid then
    -- Ləğv olunmuş sifarişlər hesaba daxil deyil: onlar nə ödənilir, nə də
    -- ödənilməmiş kimi qalmalıdır.
    update public.orders
    set payment_status = 'paid',
        paid_at = now(),
        paid_by = auth.uid(),
        -- Faktiki ödəniş üsulu yazılır. Müştəri sifariş anında "nəğd" seçib
        -- sonda kartla ödəyə bilər — hesabatda faktiki üsul qalmalıdır,
        -- niyyət yox. Üsul verilməyibsə mövcud dəyər saxlanılır.
        payment_method = coalesce(p_payment_method, payment_method),
        payment_method_label = coalesce(p_payment_method_label, payment_method_label)
    where restaurant_id = p_restaurant_id
      and table_id = p_table_id
      and payment_status = 'unpaid'
      and status <> 'cancelled';
  else
    -- Səhv təsdiqin geri alınması. Eyni avtorizasiya, eyni əhatə.
    update public.orders
    set payment_status = 'unpaid',
        paid_at = null,
        paid_by = null
    where restaurant_id = p_restaurant_id
      and table_id = p_table_id
      and payment_status = 'paid'
      and status <> 'cancelled';
  end if;

  get diagnostics v_count = row_count;

  select coalesce(sum(total), 0) into v_total
  from public.orders
  where restaurant_id = p_restaurant_id
    and table_id = p_table_id
    and status <> 'cancelled'
    and payment_status = case when p_paid then 'paid' else 'unpaid' end;

  -- Hesab bağlananda masanın aktiv "hesab istəyi" bildirişi də eyni
  -- tranzaksiyada həll edilir — əks halda işçi iki ayrı əməliyyat etməli
  -- olardı və bildiriş ödənişdən sonra da ekranda qalardı.
  if p_paid then
    update public.alerts
    set status = 'resolved',
        updated_at = now()
    where restaurant_id = p_restaurant_id
      and table_id = p_table_id
      and type = 'bill'
      and status = 'active';
  end if;

  return jsonb_build_object('settled_count', v_count, 'settled_total', v_total);
end;
$fn$;

-- Ödənişi yalnız giriş etmiş işçi bağlaya bilər. anon bu funksiyaya
-- ümumiyyətlə çatmamalıdır (0020-nin qurduğu revoke naxışı).
revoke all on function public.settle_table_payment(uuid, uuid, text, text, boolean) from public;
revoke all on function public.settle_table_payment(uuid, uuid, text, text, boolean) from anon;
grant execute on function public.settle_table_payment(uuid, uuid, text, text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. get_table_orders() — müştərinin öz masasının sifarişlərini oxuması
-- ----------------------------------------------------------------------------
-- Yuxarıdakı PROBLEM 2-ni bağlayır. Geniş anon SELECT siyasəti ƏVƏZİNƏ dar
-- funksiya: 0020 məhz buna görə restaurants_public VIEW-unu
-- get_public_restaurant() funksiyası ilə əvəzləmişdi — açıq sütun siyahısı
-- gələcəkdə diqqətsizcə genişləndirilə bilməz.
--
-- Giriş qapısı QR token-dir: place_order()/upsert_alert() ilə eyni
-- verify_qr_token() yoxlaması. Yəni müştəri yalnız fiziki olaraq oturduğu
-- masanın imzalı linkinə sahibdirsə həmin masanın sifarişlərini görür.
--
-- Nəticə PostgREST-in qaytardığı forma ilə eyni şəkillənir (order_items,
-- restaurant_tables yuvalanmış açarları) ki, client-dəki mövcud
-- normalizeOrder() funksiyası dəyişmədən işləsin.
create or replace function public.get_table_orders(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_qr_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $fn$
declare
  v_result jsonb;
begin
  if p_restaurant_id is null or p_table_id is null
     or not public.verify_qr_token(p_restaurant_id, p_table_id, p_qr_token) then
    raise exception 'Etibarsız və ya köhnəlmiş QR link.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at), '[]'::jsonb)
  into v_result
  from (
    select
      ord.id,
      ord.table_id,
      ord.status,
      ord.total,
      ord.note,
      ord.payment_method,
      ord.payment_method_label,
      ord.payment_status,
      ord.paid_at,
      ord.created_at,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'quantity', oi.quantity,
          'price', oi.price,
          'note', oi.note,
          'product', to_jsonb(prod.*)
        )), '[]'::jsonb)
        from public.order_items oi
        left join public.products prod on prod.id = oi.product_id
        where oi.order_id = ord.id
      ) as order_items,
      jsonb_build_object('table_number', tbl.table_number) as restaurant_tables
    from public.orders ord
    left join public.restaurant_tables tbl on tbl.id = ord.table_id
    where ord.restaurant_id = p_restaurant_id
      and ord.table_id = p_table_id
      -- Bir yemək seansından köhnə sifarişlər göstərilmir: masanın bütün
      -- tarixçəsini açmaq lazım deyil, ödənilməmiş qalıq isə bu pəncərəyə
      -- rahat sığır.
      and ord.created_at > now() - interval '24 hours'
  ) o;

  return v_result;
end;
$fn$;

-- Bu, məhz anonim müştəri üçündür (place_order/upsert_alert ilə eyni
-- auditoriya), ona görə anon EXECUTE burada QƏSDƏN verilir.
revoke all on function public.get_table_orders(uuid, uuid, text) from public;
grant execute on function public.get_table_orders(uuid, uuid, text) to anon, authenticated;
