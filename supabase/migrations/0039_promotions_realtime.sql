-- Banner, campaign and discount mutations are rendered in the public QR menu.
-- Supabase only emits postgres_changes for tables included in this publication;
-- without these entries an open customer menu stays stale until a full reload.
-- The catalog tables were added in 0034, while these promotion tables were
-- inadvertently omitted.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['banners', 'campaigns', 'discounts']
  loop
    if not exists (
      select 1
      from pg_publication_rel publication_rel
      join pg_publication publication on publication.oid = publication_rel.prpubid
      join pg_class relation on relation.oid = publication_rel.prrelid
      join pg_namespace schema on schema.oid = relation.relnamespace
      where publication.pubname = 'supabase_realtime'
        and schema.nspname = 'public'
        and relation.relname = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
