-- ============================================================================
-- MenuFlow — Özünəxidmətdə təhvil = ödəniş tamamlandı
-- ============================================================================
-- 0045 üç iş modeli gətirdi. Özünəxidmətdə (self_service) ofisiant yoxdur:
-- müştəri sifarişini kassadan özü götürür və pulu elə həmin an verir. Yəni
-- "təhvil verildi" və "ödəniş alındı" AYRI iki hadisə deyil, eyni andır.
--
-- ----------------------------------------------------------------------------
-- NİYƏ settle_table_payment() KİFAYƏT ETMİR
-- ----------------------------------------------------------------------------
-- Mövcud settle_table_payment() (0025) MASA əsaslıdır: bir çağırışda həmin
-- masanın BÜTÜN ödənilməmiş sifarişlərini bağlayır. Ofisiantlı restoranda bu
-- doğrudur — hesab masaya gəlir. Özünəxidmətdə isə yanlışdır: eyni masadan iki
-- ayrı sifariş verilibsə, birincisini təhvil verməklə ikincisi də "ödənilib"
-- olardı, halbuki o hələ mətbəxdədir və pulu alınmayıb.
--
-- Ona görə burada SİFARİŞ əsaslı, dar bir funksiya var. settle_table_payment()
-- olduğu kimi qalır — ofisiantlı modellər onu işlətməyə davam edir.
--
-- ----------------------------------------------------------------------------
-- TƏHLÜKƏSİZLİK
-- ----------------------------------------------------------------------------
-- Restoran id-si PARAMETR KİMİ QƏBUL EDİLMİR — sifariş sətrindən özü çıxarılır,
-- sonra is_staff_of() ilə yoxlanılır. CLAUDE.md-dəki qayda budur: SECURITY
-- DEFINER funksiya çağıranın kimliyini özü yenidən çıxarmalıdır, ötürülən id-yə
-- güvənməməlidir. Əks halda bir restoranın işçisi başqa restoranın sifarişini
-- ödənilmiş yaza bilərdi.
-- ============================================================================

create or replace function public.hand_over_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_restaurant_id uuid;
  v_status text;
  v_payment_status text;
begin
  if p_order_id is null then
    raise exception 'Sifariş tələb olunur.' using errcode = 'P0001';
  end if;

  select restaurant_id, status, payment_status
    into v_restaurant_id, v_status, v_payment_status
  from public.orders
  where id = p_order_id;

  if v_restaurant_id is null then
    raise exception 'Sifariş tapılmadı.' using errcode = 'P0001';
  end if;

  -- Tenant izolyasiyası. is_staff_of() super_admin-i də əhatə edir.
  if not public.is_staff_of(v_restaurant_id) then
    raise exception 'Bu əməliyyat üçün səlahiyyətiniz yoxdur.' using errcode = 'P0001';
  end if;

  -- Ləğv olunmuş sifariş nə təhvil verilir, nə də ödənilir.
  if v_status = 'cancelled' then
    raise exception 'Ləğv olunmuş sifariş təhvil verilə bilməz.' using errcode = 'P0001';
  end if;

  -- Artıq ödənilmiş sifarişin paid_at/paid_by dəyərləri KORLANMIR: yalnız
  -- hələ ödənilməmiş olanda yazılır. Əks halda təkrar klik ilk ödənişin
  -- vaxtını və onu qəbul edən işçini üzərinə yazardı.
  update public.orders
  set status = 'served',
      payment_status = 'paid',
      paid_at = case when payment_status = 'unpaid' then now() else paid_at end,
      paid_by = case when payment_status = 'unpaid' then auth.uid() else paid_by end
  where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'was_unpaid', v_payment_status = 'unpaid'
  );
end;
$fn$;

-- 0020/0025-in revoke naxışı: anon bu funksiyaya ümumiyyətlə çatmamalıdır.
revoke all on function public.hand_over_order(uuid) from public;
revoke all on function public.hand_over_order(uuid) from anon;
grant execute on function public.hand_over_order(uuid) to authenticated;
