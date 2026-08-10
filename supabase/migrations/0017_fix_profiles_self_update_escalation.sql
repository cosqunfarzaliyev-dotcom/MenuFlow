-- ============================================================================
-- MenuFlow — SECURITY FIX: profiles_self_update privilege escalation
-- ============================================================================
-- 0001_multi_tenant_saas.sql created a "profiles_self_update" policy that
-- lets any authenticated user update their own profiles row. The policy
-- checks `using (id = auth.uid())` but has no `with check` clause, which
-- means there is nothing stopping a user from changing their own `role` or
-- `restaurant_id` column — they could promote themselves to 'super_admin'
-- with a single REST call:
--
--   supabase.from('profiles')
--     .update({ role: 'super_admin' })
--     .eq('id', '<their own user id>')
--
-- Fix: add a `with check` clause that allows the update only when:
--   a) the caller is already a super_admin (can change anything), OR
--   b) the new row's role and restaurant_id are unchanged from what is
--      already stored (so users can update their own non-sensitive profile
--      fields without being able to elevate themselves).
--
-- Run this after 0001_multi_tenant_saas.sql.
-- ============================================================================

-- Re-create the policy with a WITH CHECK that prevents self-elevation.
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using   (id = auth.uid() or public.is_super_admin())
  with check (
    -- Super-admins may change any column on any profile.
    public.is_super_admin()
    or (
      -- Regular users may update their own row only if `role` and
      -- `restaurant_id` remain exactly as they are stored right now.
      -- This lets users change their display name / email / avatar / etc.
      -- without being able to self-promote or hijack another restaurant.
      role          = (select p.role          from public.profiles p where p.id = auth.uid())
      and restaurant_id = (select p.restaurant_id from public.profiles p where p.id = auth.uid())
    )
  );
