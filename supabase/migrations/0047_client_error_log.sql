-- ============================================================================
-- MenuFlow — Müştəri tərəfi xəta jurnalı
-- ============================================================================
-- İndiyə qədər brauzerdə baş verən xətaları görməyin HEÇ BİR yolu yox idi.
-- Müştərinin telefonunda menyu çökürsə, bundan yalnız müştəri xəbər tuturdu.
-- Tətbiqin arxa tərəfi yoxdur (CLAUDE.md: "There is (almost) no backend"), ona
-- görə server logları da yoxdur — yəni bu boşluq tam idi.
--
-- Sentry kimi xarici xidmət hesab və DSN tələb edir; bu cədvəl isə mövcud
-- Supabase quruluşunun içində dərhal işləyir. Sonradan Sentry əlavə olunarsa,
-- lib/services/errorService.js-dəki tək çağırış nöqtəsi dəyişdirilir.
--
-- ----------------------------------------------------------------------------
-- SÜTUNLARIN HAMISI MÜŞTƏRİDƏN GƏLMİR
-- ----------------------------------------------------------------------------
-- profile_id və restaurant_id MÜŞTƏRİ TƏRƏFİNDƏN GÖNDƏRİLMİR — trigger onları
-- auth.uid() üzərindən özü çıxarır. Səbəb CLAUDE.md-dəki qayda ilə eynidir:
-- ötürülən id-yə güvənmək olmaz. Əks halda istənilən anon istifadəçi xətanı
-- başqa restoranın adına yaza bilərdi.
-- ============================================================================

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  -- Trigger doldurur, müştəri yox.
  profile_id uuid references auth.users(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  -- 'customer' | 'admin' | 'staff' | 'superadmin' | 'marketing'
  surface text,
  message text not null,
  stack text,
  url text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists client_errors_created_at_idx on public.client_errors(created_at desc);
create index if not exists client_errors_restaurant_id_idx on public.client_errors(restaurant_id);

comment on table public.client_errors is
  'Brauzerdə baş verən JS xətaları. Anon (müştəri menyusu) da yaza bilir — məhz ora ən çox lazımdır. profile_id/restaurant_id trigger tərəfindən auth.uid()-dən çıxarılır, müştəridən qəbul edilmir.';

-- ----------------------------------------------------------------------------
-- Sahələrin kəsilməsi, kimliyin çıxarılması və sürət limiti.
--
-- Limit aşılanda NULL qaytarılır: BEFORE INSERT trigger-də bu, sətri səssizcə
-- ATIR. Qəsdəndir — xəta bildirişinin özü xəta verməməlidir, əks halda
-- errorService.js sonsuz döngəyə düşə bilər.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_client_error_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_recent int;
begin
  -- Ölçü qoruması: stack trace-lər çox uzun ola bilir.
  new.message := left(coalesce(new.message, ''), 500);
  new.stack := left(new.stack, 4000);
  new.url := left(new.url, 500);
  new.user_agent := left(new.user_agent, 300);
  new.surface := left(new.surface, 32);

  if new.message = '' then
    return null;
  end if;

  -- Kimlik SERVERDƏ çıxarılır (bax: başlıqdakı izah).
  new.profile_id := auth.uid();
  if new.profile_id is not null then
    select p.restaurant_id into new.restaurant_id
    from public.profiles p where p.id = new.profile_id;
  else
    new.restaurant_id := null;
  end if;

  -- Dəqiqədə 20 sətir (restoran başına; anon sətirlər bir səbəti paylaşır).
  -- Bir çökən səhifə saniyədə onlarla eyni xətanı ata bilər.
  select count(*) into v_recent
  from public.client_errors
  where created_at > now() - interval '1 minute'
    and restaurant_id is not distinct from new.restaurant_id;

  if v_recent >= 20 then
    return null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists client_errors_enforce_limits on public.client_errors;
create trigger client_errors_enforce_limits
  before insert on public.client_errors
  for each row execute function public.enforce_client_error_limits();

-- ----------------------------------------------------------------------------
-- RLS: hamı yaza bilər, yalnız super_admin oxuya/silə bilər.
--
-- Yazma anon-a da açıqdır, çünki ən vacib səth məhz autentifikasiyasız müştəri
-- menyusudur. Oxuma bağlıdır: stack trace və URL-lər daxili məlumatdır.
-- ----------------------------------------------------------------------------
alter table public.client_errors enable row level security;

drop policy if exists client_errors_anyone_insert on public.client_errors;
create policy client_errors_anyone_insert on public.client_errors
  for insert to anon, authenticated with check (true);

drop policy if exists client_errors_super_admin_read on public.client_errors;
create policy client_errors_super_admin_read on public.client_errors
  for select to authenticated using (public.is_super_admin());

drop policy if exists client_errors_super_admin_delete on public.client_errors;
create policy client_errors_super_admin_delete on public.client_errors
  for delete to authenticated using (public.is_super_admin());

-- Trigger funksiyasıdır — PostgREST üzərindən RPC kimi çağırılmasının heç bir
-- mənası yoxdur (NEW olmadan onsuz da xəta verər), ona görə EXECUTE geri
-- alınır. get_advisors bunu digər trigger funksiyaları üçün də bildirir; bu
-- pass yalnız yeni əlavə olunanı təmiz saxlayır, köhnələri qaşımır.
revoke all on function public.enforce_client_error_limits() from public;
revoke all on function public.enforce_client_error_limits() from anon;
revoke all on function public.enforce_client_error_limits() from authenticated;
