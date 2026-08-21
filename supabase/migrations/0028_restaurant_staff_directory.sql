-- ============================================================================
-- MenuFlow — restoran admininə öz heyət siyahısını göstərmək
-- ============================================================================
-- AdminApp.jsx-in "İstifadəçilər" tabı bu günə qədər `UsersPlaceholder`
-- idi — yalnız giriş etmiş adminin öz kartını göstərirdi və "ayrıca heyət
-- qeydiyyatı lazım deyil" mətni yazırdı, halbuki `staff` rollu hesablar
-- real mövcuddur (create-restaurant-user Edge Function `role:'staff'`
-- qəbul edir, super-admin RestaurantsTab.jsx-dən yaradılır). Bu, admin üçün
-- yanıldıcı idi: özününkindən başqa heç bir hesab görünmürdü.
--
-- Bu miqrasiya YALNIZ oxu yolu əlavə edir — hesab yaratma/silmə/rol dəyişmə
-- hələ də ciddi şəkildə super-admin-only qalır (CLAUDE.md-nin D1 qərarı,
-- bax lib/services/capabilityService.js-in USERS_MANAGE şərhi). Restoran
-- admini bu gün öz heyətini SİYAHILAYA BİLMİR (profiles_self_read =
-- `id = auth.uid() or is_super_admin()`, 0001_multi_tenant_saas.sql), ona
-- görə dar, açıq sütun siyahılı bir RPC lazımdır — get_pos_integration_
-- status()-un (0026) tam eyni forması: security definer, is_admin_of()
-- qapısı, RLS-in özü heç genişləndirilmir.
-- ============================================================================

create or replace function public.get_restaurant_staff(p_restaurant_id uuid)
returns table (id uuid, email text, role text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.email, p.role
  from public.profiles p
  where public.is_admin_of(p_restaurant_id)
    and p.restaurant_id = p_restaurant_id
    and p.role in ('restaurant_admin', 'staff')
  order by p.role, p.email;
$$;

-- is_admin_of() daxildə auth.uid()-i yenidən yoxlayır (heç vaxt parametr
-- kimi verilən id-yə güvənmir) — is_admin_of()-un öz şərhinə bax (0026).
-- staff rolu istisna edilir: is_admin_of() `restaurant_admin`/`super_admin`
-- xaricini rədd edir, ona görə bir ofisiant öz həmkarlarının siyahısına
-- çata bilməz.
revoke all on function public.get_restaurant_staff(uuid) from public, anon;
grant execute on function public.get_restaurant_staff(uuid) to authenticated;
