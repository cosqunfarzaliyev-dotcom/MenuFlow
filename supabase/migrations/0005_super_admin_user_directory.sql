-- ============================================================================
-- MenuFlow — Super Admin user directory
-- ============================================================================
-- Powers the "İstifadəçilər" (User Management) tab of /superadmin.
--
-- profiles has no last-login tracking of its own, but Supabase Auth already
-- maintains auth.users.last_sign_in_at for every account. Rather than
-- duplicating that into a new column (and having to remember to touch it on
-- every login), this exposes it read-only via a security-definer RPC that
-- only a super_admin can call — no service-role key needed client-side.
-- ============================================================================

create or replace function public.get_platform_users()
returns table (
  id uuid,
  email text,
  role text,
  restaurant_id uuid,
  restaurant_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.email,
    p.role,
    p.restaurant_id,
    r.name as restaurant_name,
    p.created_at,
    u.last_sign_in_at
  from public.profiles p
  left join public.restaurants r on r.id = p.restaurant_id
  left join auth.users u on u.id = p.id
  where public.is_super_admin()
    and p.role in ('super_admin', 'restaurant_admin', 'staff')
  order by u.last_sign_in_at desc nulls last;
$$;

grant execute on function public.get_platform_users() to authenticated;
