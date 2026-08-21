-- ============================================================================
-- MenuFlow — Web Push bildirişləri (heyət üçün)
-- ============================================================================
-- Hazırda bütün heyət xəbərdarlığı yalnız tətbiqdaxilidir (Realtime + audio
-- chime, StaffApp.jsx) — brauzer sekmə bağlıdırsa heyət yeni sifarişi/ofisiant
-- çağırışını görmür. public/sw.js, manifest-{admin,staff,superadmin}.json və
-- ikonlar artıq mövcuddur (hər üç panel "installable PWA" testindən keçir) —
-- yalnız `push`/`notificationclick` handler-ləri əskikdir (bax public/sw.js).
--
-- Bu miqrasiya push_order_to_pos()-un (0026/0027) EYNİ nümunəsini təkrarlayır:
-- Vault-dan paylaşılan sirr, app_secrets-dən funksiya baza URL-i, pg_net ilə
-- async POST, fail-open (heç vaxt sifariş/alert INSERT-ini bloklamır).
--
-- FƏRQ: pos_integrations-dan fərqli olaraq push_subscriptions RLS-i SIFIR
-- SİYASƏT deyil — real siyasətlərlə qorunur (sahib öz abunəliyini yaza/silə
-- bilər), çünki bu, xarici API tokeni deyil, sadəcə brauzer push endpoint-i
-- saxlayan cədvəldir (0026-nın pos_integrations-dan fərqli risk sinfi).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. push_subscriptions
-- ----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);

create index if not exists push_subscriptions_restaurant_id_idx on public.push_subscriptions (restaurant_id);
create index if not exists push_subscriptions_profile_id_idx on public.push_subscriptions (profile_id);

comment on table public.push_subscriptions is
  'Bir brauzer/cihazın Web Push abunəliyi (staff/restaurant_admin). endpoint qlobal unikaldır (bir push servisi tərəfindən verilir). notify-push Edge Function service-role ilə oxuyur/yazır (failure_count/last_success_at) — RLS-i bypass edir, aşağıdakı siyasətlər yalnız birbaşa PostgREST client çağırışlarına aiddir.';

alter table public.push_subscriptions enable row level security;

-- Sahib öz abunəliyini yarada/oxuya/silə bilər. UPDATE siyasəti yoxdur —
-- client heç vaxt öz sətrini birbaşa PATCH etmir (failure_count/
-- last_success_at yalnız service-role tərəfindən yazılır); yenidən abunə
-- olma supabase-js .upsert({onConflict:'endpoint'}) ilə INSERT kimi gedir.
create policy push_subscriptions_self_read on public.push_subscriptions
  for select using (profile_id = auth.uid());

create policy push_subscriptions_self_insert on public.push_subscriptions
  for insert with check (profile_id = auth.uid());

create policy push_subscriptions_self_delete on public.push_subscriptions
  for delete using (profile_id = auth.uid());

-- restaurant_id-nin client tərəfindən "yalan deyilməsi"nin qarşısını alır:
-- INSERT siyasəti yalnız profile_id = auth.uid() yoxlayır, restaurant_id-ni
-- yox — bu trigger olmasa, öz profile_id-si ilə amma BAŞQA restoranın
-- restaurant_id-sini göndərən bir istifadəçi öz cihazını o restoranın push
-- fan-out-una qata bilərdi. protect_restaurant_privileged_fields() (0006)
-- ilə eyni "client-supplied privileged column-a güvənmə" məntiqi.
create or replace function public.set_push_subscription_restaurant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  select restaurant_id into new.restaurant_id
  from public.profiles where id = new.profile_id;
  return new;
end;
$fn$;

drop trigger if exists push_subscriptions_force_restaurant_id on public.push_subscriptions;
create trigger push_subscriptions_force_restaurant_id
  before insert or update on public.push_subscriptions
  for each row execute procedure public.set_push_subscription_restaurant_id();

revoke all on function public.set_push_subscription_restaurant_id() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. notify_push() — daxili köməkçi, iki trigger tərəfindən paylaşılır
-- ----------------------------------------------------------------------------
-- KRİTİK XÜSUSİYYƏT: push_order_to_pos()-da olduğu kimi, bu funksiya HEÇ
-- VAXT exception atmamalıdır — bildiriş sistemi sıradan çıxsa belə, sifariş/
-- alert INSERT-i bloklanmaz.
create or replace function public.notify_push(p_restaurant_id uuid, p_title text, p_body text, p_tag text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_secret text;
  v_base_url text;
begin
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'push_notify_secret';
  exception when others then
    v_secret := null;
  end;

  if v_secret is null then
    return; -- vault hələ provisioning olunmayıb — heç vaxt bloklama
  end if;

  select coalesce(functions_base_url, 'https://evdlcbfsvvtrrmxxbzpr.supabase.co/functions/v1')
    into v_base_url
  from public.app_secrets limit 1;
  v_base_url := coalesce(v_base_url, 'https://evdlcbfsvvtrrmxxbzpr.supabase.co/functions/v1');

  perform net.http_post(
    url := v_base_url || '/notify-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-notify-secret', v_secret),
    body := jsonb_build_object('restaurant_id', p_restaurant_id, 'title', p_title, 'body', p_body, 'tag', p_tag)
  );
exception when others then
  return;
end;
$fn$;

revoke all on function public.notify_push(uuid, text, text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Trigger-lər — yeni sifariş / yeni alert (ofisiant çağırışı, hesab tələbi)
-- ----------------------------------------------------------------------------
create or replace function public.push_notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.notify_push(
    new.restaurant_id,
    'Yeni sifariş',
    'Masa ' || coalesce(new.table_number::text, '?') || ' — ' || coalesce(new.total::text, '0') || ' ₼',
    'order-' || new.id::text
  );
  return new;
exception when others then
  return new;
end;
$fn$;

drop trigger if exists orders_push_notify on public.orders;
create trigger orders_push_notify
  after insert on public.orders
  for each row execute procedure public.push_notify_new_order();

revoke all on function public.push_notify_new_order() from public, anon, authenticated;

create or replace function public.push_notify_new_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_title text;
begin
  v_title := case new.type
    when 'bill' then 'Hesab tələbi'
    else 'Ofisiant çağırışı'
  end;
  perform public.notify_push(
    new.restaurant_id,
    v_title,
    'Masa ' || coalesce(new.table_number::text, '?'),
    'alert-' || new.id::text
  );
  return new;
exception when others then
  return new;
end;
$fn$;

drop trigger if exists alerts_push_notify on public.alerts;
create trigger alerts_push_notify
  after insert on public.alerts
  for each row execute procedure public.push_notify_new_alert();

revoke all on function public.push_notify_new_alert() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Bir dəfəlik provisioning (bu migrasiyanın İCRA ETMƏDİYİ addımlar)
-- ----------------------------------------------------------------------------
-- Vault sirri — apply_migration-dan SONRA, execute_sql ilə bir dəfə:
--   select vault.create_secret('<32+ bayt təsadüfi dəyər>', 'push_notify_secret', 'Web Push trigger shared secret');
-- Eyni dəyər notify-push Edge Function-a PUSH_NOTIFY_SECRET env dəyişəni
-- kimi verilməlidir. Əlavə olaraq notify-push VAPID_PUBLIC_KEY/
-- VAPID_PRIVATE_KEY/VAPID_SUBJECT env dəyişənlərinə ehtiyac duyur (bax
-- supabase/functions/notify-push/index.ts-in öz başlıq şərhi) — bunlar
-- Vault-da deyil, birbaşa Edge Function secret kimi saxlanılır (POS
-- inteqrasiyasının POS_ORDER_PUSH_SECRET-i ilə eyni səbəb).
