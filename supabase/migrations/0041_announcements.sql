-- ============================================================================
-- MenuFlow — Platforma elanları (SuperAdmin -> restoran sahibləri)
-- ============================================================================
-- Admin panelinin yuxarı sağındakı zəng ikonu indiyə qədər tamamilə
-- dekorativ idi: onClick-i yox, üstündəki qırmızı nöqtə isə şərtsiz render
-- olunurdu (yəni həmişə "oxunmamış var" deyirdi). Bu miqrasiya həmin ikonun
-- arxasındakı məlumat modelini qurur.
--
-- İKİ CƏDVƏL, İKİ AYRI SƏBƏB:
--   announcements       — SuperAdmin-in yazdığı elan (platforma səviyyəli,
--                         bir restorana aid DEYİL).
--   announcement_reads   — hansı profilin hansı elanı oxuduğu. Ayrıca cədvəl,
--                         çünki bir elan çox profilə göstərilir; oxunma
--                         vəziyyəti elanın öz sətrinə yazıla bilməz.
--
-- AUDIT QEYDİ: audit_logs.restaurant_id NOT NULL-dur, ona görə platforma
-- səviyyəli bir elan oraya yazıla bilməz. created_by + created_at bu elanın
-- öz audit izidir — store.recordAudit() burada çağırılmır.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. announcements
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  level text not null default 'info' check (level in ('info', 'warning', 'critical')),
  -- null = BÜTÜN restoranlar. Ayrıca birləşdirici cədvəl əvəzinə massiv:
  -- ünvan siyahısı elanın öz atributudur, müstəqil sorğulanan bir varlıq
  -- deyil, və RLS yoxlaması `= any(...)` ilə tək ifadədə qalır.
  target_restaurant_ids uuid[],
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  is_published boolean not null default false
);

create index if not exists announcements_published_idx
  on public.announcements (is_published, published_at desc);

comment on table public.announcements is
  'SuperAdmin-in restoran sahiblərinə göndərdiyi platforma elanları. target_restaurant_ids null olduqda bütün restoranlara gedir. is_published=false qaralamadır və yalnız super_admin görür.';

-- ----------------------------------------------------------------------------
-- 2. announcement_reads
-- ----------------------------------------------------------------------------
create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

create index if not exists announcement_reads_profile_idx
  on public.announcement_reads (profile_id);

comment on table public.announcement_reads is
  'Hansı profilin hansı elanı oxuduğu. Kompozit PK eyni cütün təkrarlanmasının qarşısını alır, ona görə client .upsert(ignoreDuplicates) ilə təhlükəsiz yaza bilir.';

-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- super_admin hər şeyi (qaralamalar daxil) görür və yazır — 0032-dəki
-- site_content_super_admin_write ilə eyni forma.
drop policy if exists "announcements_super_admin_all" on public.announcements;
create policy "announcements_super_admin_all" on public.announcements
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Restoran tərəfi: yalnız DƏRC EDİLMİŞ və bu restorana ünvanlanan elanlar.
--
-- DİQQƏT: burada `profiles`-a birbaşa subquery YAZILMIR. profiles özü RLS
-- altındadır və siyasət daxilindəki subquery çağıran istifadəçinin hüququ
-- ilə işləyir — yəni belə bir subquery RLS-in RLS-ə baxması olardı və
-- gözlənilməz nəticə verərdi. Onun əvəzinə mövcud SECURITY DEFINER köməkçisi
-- current_restaurant_id() istifadə olunur.
--
-- İki permissive SELECT siyasəti PostgreSQL tərəfindən OR-lanır, ona görə
-- super_admin yuxarıdakı siyasət sayəsində hər şeyi görməyə davam edir.
drop policy if exists "announcements_tenant_read" on public.announcements;
create policy "announcements_tenant_read" on public.announcements
  for select to authenticated using (
    is_published
    and (
      target_restaurant_ids is null
      or public.current_restaurant_id() = any (target_restaurant_ids)
    )
  );

-- Oxunma qeydləri sırf şəxsidir — push_subscriptions_self_* (0030) nümunəsi.
-- UPDATE siyasəti yoxdur: bir sətir ya var (oxunub), ya yoxdur.
drop policy if exists "announcement_reads_self_read" on public.announcement_reads;
create policy "announcement_reads_self_read" on public.announcement_reads
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists "announcement_reads_self_insert" on public.announcement_reads;
create policy "announcement_reads_self_insert" on public.announcement_reads
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "announcement_reads_self_delete" on public.announcement_reads;
create policy "announcement_reads_self_delete" on public.announcement_reads
  for delete to authenticated using (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. Realtime — açıq admin paneli yeni elanı yeniləmədən görsün.
--    0039_promotions_realtime.sql-dəki idempotent blokun eynisi.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_rel publication_rel
    join pg_publication publication on publication.oid = publication_rel.prpubid
    join pg_class relation on relation.oid = publication_rel.prrelid
    join pg_namespace schema on schema.oid = relation.relnamespace
    where publication.pubname = 'supabase_realtime'
      and schema.nspname = 'public'
      and relation.relname = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. RLS initplan optimallaşdırması
--    auth.uid() -> (select auth.uid()): planlayıcı onu hər SƏTİR üçün yox, hər
--    SORĞU üçün bir dəfə hesablayır (Supabase advisor 0003_auth_rls_initplan).
--    push_subscriptions (0030) bu formanı işlətmir və advisor-da xəbərdarlıq
--    verir — yeni cədvəldə həmin məlum qüsuru təkrarlamağın mənası yoxdur.
-- ----------------------------------------------------------------------------
drop policy if exists "announcement_reads_self_read" on public.announcement_reads;
create policy "announcement_reads_self_read" on public.announcement_reads
  for select to authenticated using (profile_id = (select auth.uid()));

drop policy if exists "announcement_reads_self_insert" on public.announcement_reads;
create policy "announcement_reads_self_insert" on public.announcement_reads
  for insert to authenticated with check (profile_id = (select auth.uid()));

drop policy if exists "announcement_reads_self_delete" on public.announcement_reads;
create policy "announcement_reads_self_delete" on public.announcement_reads
  for delete to authenticated using (profile_id = (select auth.uid()));

-- announcements_created_by_fkey üçün örtük indeks (advisor 0001).
create index if not exists announcements_created_by_idx on public.announcements (created_by);
