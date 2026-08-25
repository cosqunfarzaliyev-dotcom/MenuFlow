-- Kampaniyalar (campaigns) tam silinir.
--
-- Bu funksiya banner sistemi ilə üst-üstə düşürdü: hər ikisi müştəri
-- menyusunun yuxarısında şəkil + başlıq + alt yazı göstərirdi, sadəcə
-- kampaniyaların əlavə olaraq starts_at/ends_at pəncərəsi vardı və heç bir
-- CTA/action dəstəyi yox idi (0019_banner_actions.sql bunu yalnız banners
-- üçün əlavə etmişdi). İki ayrı promo mexanizmi saxlamaq əvəzinə banner
-- sistemi yeganə promo səthi olaraq qalır, endirimlər (discounts) isə
-- qiymətə təsir edən ayrı bir ox kimi toxunulmaz qalır.
--
-- Tətbiq anında `campaigns` sıfır sətirdən ibarət idi və heç bir discount
-- sətri campaign_id daşımırdı, ona görə burada məlumat itkisi yoxdur.

-- 1. Realtime publication-dan çıxar (0039_promotions_realtime.sql əlavə
--    etmişdi). Cədvəl düşməzdən əvvəl edilir ki, publication-da asılı qeyd
--    qalmasın.
do $$
begin
  if exists (
    select 1
    from pg_publication_rel publication_rel
    join pg_publication publication on publication.oid = publication_rel.prpubid
    join pg_class relation on relation.oid = publication_rel.prrelid
    join pg_namespace schema on schema.oid = relation.relnamespace
    where publication.pubname = 'supabase_realtime'
      and schema.nspname = 'public'
      and relation.relname = 'campaigns'
  ) then
    alter publication supabase_realtime drop table public.campaigns;
  end if;
end;
$$;

-- 2. discounts.campaign_id — kampaniyaya bağlanma imkanı. UI heç vaxt bu
--    sütunu doldurmurdu (PromotionsTab yalnız title/type/value/product_id
--    göndərir), ona görə sütun tamamilə silinir; FK constraint də onunla
--    birlikdə gedir.
alter table public.discounts drop column if exists campaign_id;

-- 3. RLS siyasətləri cədvəllə birlikdə düşür, amma açıq şəkildə yazılır ki,
--    0006_admin_feature_pack.sql-dəki cütlüyün harada bitdiyi diffdə görünsün.
drop policy if exists "campaigns_public_read" on public.campaigns;
drop policy if exists "campaigns_tenant_write" on public.campaigns;

drop table if exists public.campaigns;
