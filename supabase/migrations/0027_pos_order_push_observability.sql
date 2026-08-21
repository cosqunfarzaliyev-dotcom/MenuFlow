-- ============================================================================
-- MenuFlow — POS sifariş ötürülməsi: konfiqurasiya + müşahidə qabiliyyəti
-- ============================================================================
-- İki problemi həll edir:
--
-- 1) 0026-da funksiya baza URL-i push_order_to_pos() içinə hardcode edilmişdi.
--    Artıq app_secrets-dən oxunur (aşağıda səbəbi izah olunur).
--
-- 2) Sifariş ötürülməsi TAM SƏSSİZ idi. push_order_to_pos() fail-open-dır
--    (doğrudur — POS nasazlığı sifarişi bloklamamalıdır), amma həm də
--    fail-silent idi: Edge Function 500/401 qaytarsa, pos_integrations-a heç
--    nə yazılmırdı. Nəticədə admin üçün bu üç hal eyni görünürdü:
--      • ötürülmə qəsdən söndürülüb
--      • konfiqurasiya yarımçıqdır (POS_ORDER_PUSH_SECRET təyin edilməyib)
--      • Poster sifarişi rədd etdi
--    Real nümunə: net._http_response-da 500 "Edge function environment is not
--    configured" var idi, amma UI "heç vaxt sinxronlaşdırılmayıb" göstərirdi.
--
--    Həll: 'pending' vəziyyəti. Trigger POST-dan sonra 'pending' damğalayır;
--    Edge Function cavab verəndə onu 'success'/'error' ilə əvəz edir. Beləliklə
--    "uzun müddət pending" = "funksiya heç cavab vermədi" — görünən vəziyyət.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. app_secrets.functions_base_url
-- ----------------------------------------------------------------------------
-- Niyə Vault deyil: funksiya baza URL-i sirr deyil, sadəcə konfiqurasiyadır.
-- Niyə `alter database ... set` deyil: repo-da görünmür və layihə restore/
-- preview branch-da yaşamır.
-- app_secrets (0008) onsuz da bu kod bazasının singleton DB-konfiq cədvəlidir:
-- RLS açıq, anon/authenticated-dən revoke edilib, yalnız security definer
-- funksiyaların içindən oxunur.
alter table public.app_secrets add column if not exists functions_base_url text;

comment on column public.app_secrets.functions_base_url is
  'Edge Function baza URL-i (sonda / olmadan), məs. https://<ref>.supabase.co/functions/v1. push_order_to_pos() buradan oxuyur.';

update public.app_secrets
   set functions_base_url = 'https://evdlcbfsvvtrrmxxbzpr.supabase.co/functions/v1'
 where functions_base_url is null;

-- ----------------------------------------------------------------------------
-- 2. order_push_status: 'pending' + son cəhd vaxtı
-- ----------------------------------------------------------------------------
alter table public.pos_integrations
  drop constraint if exists pos_integrations_order_push_status_check;

alter table public.pos_integrations
  add constraint pos_integrations_order_push_status_check
  check (order_push_status in ('never', 'pending', 'success', 'error'));

alter table public.pos_integrations
  add column if not exists order_push_last_attempt_at timestamptz;

comment on column public.pos_integrations.order_push_last_attempt_at is
  'Trigger-in Edge Function-a POST etdiyi son an. status=pending və bu dəyər köhnədirsə — funksiya cavab vermir (çox güman POS_ORDER_PUSH_SECRET təyin edilməyib).';

-- ----------------------------------------------------------------------------
-- 3. push_order_to_pos() — yenidən
-- ----------------------------------------------------------------------------
-- 0026-dakı kritik xüsusiyyət qorunur: bu funksiya HEÇ VAXT exception atmır.
-- Yeni status yazıları da öz daxili exception bloklarındadır ki, status
-- yazısının özü sifariş INSERT-ini batıra bilməsin.
create or replace function public.push_order_to_pos()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_enabled  boolean;
  v_secret   text;
  v_base_url text;
begin
  select sync_orders_enabled into v_enabled
  from public.pos_integrations
  where restaurant_id = new.restaurant_id and provider = 'poster';

  -- İnteqrasiya qurulmayıb və ya ötürülmə qəsdən söndürülüb.
  -- Bu XƏTA DEYİL — status yazmırıq. get_pos_integration_status() onsuz da
  -- sync_orders_enabled qaytarır, UI "söndürülüb"ü həmin sahədən göstərir.
  if not coalesce(v_enabled, false) then
    return new;
  end if;

  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'pos_order_push_secret';
  exception when others then
    v_secret := null;
  end;

  -- Bu, DB-nin öz-özünə aşkarlaya bildiyi YEGANƏ həqiqi səhv konfiqurasiyadır:
  -- ötürülmə açıqdır, amma paylaşılan sirr yoxdur. Səssiz keçmək əvəzinə yazırıq.
  if v_secret is null then
    begin
      update public.pos_integrations
         set order_push_status = 'error',
             order_push_error = 'pos_order_push_secret Vault-da yoxdur — sifariş ötürülməsi konfiqurasiya edilməyib',
             order_push_last_attempt_at = now()
       where restaurant_id = new.restaurant_id
         and provider = 'poster'
         and order_push_status is distinct from 'error';
    exception when others then
      null;
    end;
    return new;
  end if;

  select coalesce(functions_base_url, 'https://evdlcbfsvvtrrmxxbzpr.supabase.co/functions/v1')
    into v_base_url
  from public.app_secrets limit 1;

  -- coalesce YÜK DAŞIYICIDIR: onsuz miqrasiyalardan qurulmuş təzə bazada
  -- (app_secrets sətri yoxdursa/null-dırsa) v_base_url null olar, net.http_post
  -- xəta verər, aşağıdakı blok udar və biz yenidən səssiz no-op vəziyyətinə
  -- düşərik — məhz düzəltdiyimiz problem.
  v_base_url := coalesce(v_base_url, 'https://evdlcbfsvvtrrmxxbzpr.supabase.co/functions/v1');

  perform net.http_post(
    url := v_base_url || '/pos-poster-order-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pos-push-secret', v_secret),
    body := jsonb_build_object('order_id', new.id, 'restaurant_id', new.restaurant_id)
  );

  -- "Göndərildi, cavab gözlənilir". Edge Function bunu success/error ilə əvəz edir.
  --
  -- `is distinct from 'pending'` şərti KOSMETİK DEYİL: onsuz hər sifariş
  -- tenant-ın tək pos_integrations sətrinə yazır və həmin sətri place_order()
  -- tranzaksiyasının sonuna qədər kilidləyir — eyni restoranda paralel
  -- sifarişlər seriyalaşır. Bu şərtlə sabit vəziyyətdə update heç işləmir.
  begin
    update public.pos_integrations
       set order_push_status = 'pending',
           order_push_error = null,
           order_push_last_attempt_at = now()
     where restaurant_id = new.restaurant_id
       and provider = 'poster'
       and order_push_status is distinct from 'pending';
  exception when others then
    null;
  end;

  return new;
exception when others then
  -- Son müdafiə xətti (0026-dan olduğu kimi saxlanılır).
  return new;
end;
$fn$;

-- create or replace qrantları saxlayır, amma 0026a-nın revoke-unu açıq şəkildə
-- təkrarlayırıq ki, bu fayl tək başına oxunanda da tam mənzərə görünsün.
revoke all on function public.push_order_to_pos() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. get_pos_integration_status() — yeni sahəni qaytarsın
-- ----------------------------------------------------------------------------
-- UI "pending nə qədərdir?" sualını cavablandıra bilməsi üçün
-- order_push_last_attempt_at əlavə olunur. Qalan hər şey 0026-dakı kimidir.
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
      'order_push_status', 'never', 'order_push_error', null, 'order_push_synced_at', null,
      'order_push_last_attempt_at', null
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
    'order_push_synced_at', v_row.order_push_synced_at,
    'order_push_last_attempt_at', v_row.order_push_last_attempt_at
  );
end;
$fn$;

revoke all on function public.get_pos_integration_status(uuid) from public, anon;
grant execute on function public.get_pos_integration_status(uuid) to authenticated;
