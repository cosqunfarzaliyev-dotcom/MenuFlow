-- ============================================================================
-- MenuFlow — Realtime & Storage Configuration (0007_realtime_and_storage.sql)
-- ============================================================================
-- 1. Enables Supabase Realtime publication for key tables so live updates
--    (orders, waiter calls, product updates, table states) broadcast to connected clients.
-- 2. Configures Supabase Storage bucket 'menuflow' for logo, product, and banner image uploads.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REALTIME PUBLICATION
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
    alter publication supabase_realtime add table public.alerts;
    alter publication supabase_realtime add table public.restaurant_tables;
    alter publication supabase_realtime add table public.products;
    alter publication supabase_realtime add table public.categories;
    alter publication supabase_realtime add table public.banners;
    alter publication supabase_realtime add table public.campaigns;
    alter publication supabase_realtime add table public.discounts;
  end if;
exception
  when duplicate_object then null;
  when undefined_object then null;
  when others then null;
end $$;

-- ----------------------------------------------------------------------------
-- 2. STORAGE BUCKET & POLICIES FOR MEDIA UPLOADS
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menuflow',
  'menuflow',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set public = true;

drop policy if exists "menuflow_public_select" on storage.objects;
create policy "menuflow_public_select" on storage.objects
  for select using (bucket_id = 'menuflow');

drop policy if exists "menuflow_authenticated_insert" on storage.objects;
create policy "menuflow_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'menuflow');

drop policy if exists "menuflow_authenticated_update" on storage.objects;
create policy "menuflow_authenticated_update" on storage.objects
  for update to authenticated using (bucket_id = 'menuflow');

drop policy if exists "menuflow_authenticated_delete" on storage.objects;
create policy "menuflow_authenticated_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'menuflow');
