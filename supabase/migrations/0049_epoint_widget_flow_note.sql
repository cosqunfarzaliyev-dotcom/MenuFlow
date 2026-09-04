-- ============================================================================
-- MenuFlow — Epoint: redirect axınından widget (Apple Pay/Google Pay) axınına
-- ============================================================================
-- SXEM DƏYİŞMİR — bu, yalnız sənədləşmə düzəlişidir. 0048_epoint_payment_
-- integration.sql-in şərhi "1/payment-request + redirect_url + Epoint-in
-- hosted checkout səhifəsinə tam səhifə yönləndirmə" axınını təsvir edirdi.
-- Məhsul qərarı dəyişdi: müştəri artıq HEÇ VAXT MenuFlow-dan kənara
-- yönləndirilmir. epoint-create-payment indi 1/token/widget çağırır (Apple
-- Pay/Google Pay), qaytardığı widget_url isə CustomerApp.jsx-in "Hesabı ödə"
-- modalı DAXİLİNDƏ <iframe allow="payment"> kimi göstərilir. Nəticəni öyrənmək
-- üçün heç bir callback/redirect yoxdur — client widget aç olduğu müddətdə
-- epoint-confirm-payment-i (dəyişməz qalıb, 1/get-status) hər bir neçə
-- saniyədən bir sorğulayır, ilk 'success' cavabında iframe bağlanır.
--
-- payment_integrations/payment_transactions cədvəlləri, onların RLS
-- postürü, RPC-lər (upsert/disconnect/get_payment_integration_status) və
-- epoint_payment_enabled sütunu TAM olaraq 0048-dəki kimi qalır — dəyişən
-- yalnız epoint-create-payment-in Epoint-ə hansı endpoint-i çağırdığı və
-- CustomerApp.jsx-in nəticəni necə göstərdiyidir (kod tərəfi, DB yox).
--
-- 0048/0048a redaktə edilmir (bu layihədə tətbiq olunmuş miqrasiya heç vaxt
-- geriyə dönük redaktə olunmur — 0045-in 0044-ü "əvəz etməsi" ilə eyni
-- qayda), ona görə həmin faylların şərhi indi köhnəlmiş dizaynı təsvir edir;
-- bu fayl doğru mənbədir.
-- ============================================================================

comment on table public.payment_transactions is
  'Hər Epoint checkout cəhdi. id = Epoint-ə order_id kimi göndərilir (həm 1/token/widget yaradılışında, həm 1/get-status sorğulanmasında "transaction" kimi). Sıfır RLS, sıfır client grant — yalnız epoint-create-payment/epoint-confirm-payment Edge Function-larının service-role client-i yazır. Ödəniş axını: widget iframe + client-side polling, redirect YOXDUR (bax bu miqrasiyanın başlıq şərhi).';

comment on table public.payment_integrations is
  'Restoran başına Epoint kredensialları (Apple Pay/Google Pay token widget + status sorğusu üçün). Sıfır RLS policy, sıfır client grant — yalnız SECURITY DEFINER RPC-lər (admin idarəsi) və Edge Function-ların service-role client-i (epoint-create-payment/epoint-confirm-payment) çata bilər.';
