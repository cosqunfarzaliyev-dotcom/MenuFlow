-- ============================================================================
-- MenuFlow — per-user language preference (profiles.locale)
-- ============================================================================
-- Full-app AZ/EN/RU localization needs the chosen language to survive a
-- logged-in user switching devices/browsers, not just localStorage. That
-- means writing to `profiles`.
--
-- IMPORTANT CONSTRAINT: `profiles` UPDATE is super-admin-only since 0003
-- (`profiles_super_admin_update`, `using (public.is_super_admin())`). The
-- original self-update policy was dropped entirely after it let any user
-- promote themselves to super_admin (`role = 'super_admin'` via a plain
-- client UPDATE). The one file that would restore a guarded self-update
-- (0017_fix_profiles_self_update_escalation.sql) is tracked in git but
-- deliberately never applied — see CLAUDE.md, it would OR a second
-- permissive policy back in and widen access again.
--
-- So a plain `supabase.from('profiles').update({ locale })` from the client
-- fails closed for every non-super_admin. Instead of touching that policy at
-- all (out of scope, high blast radius), this adds one narrow
-- SECURITY DEFINER RPC that can only ever change the caller's own `locale`
-- column — same shape as `upsert_alert`/`create_restaurant_self_service`:
-- bypass RLS deliberately, but re-verify identity and constrain the write
-- inside the function body itself.
--
-- Run this after 0022_fix_touch_updated_at_search_path.sql.
-- ============================================================================

alter table public.profiles
  add column if not exists locale text not null default 'az';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_locale_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_locale_check check (locale in ('az', 'en', 'ru'));
  end if;
end $$;

-- SECURITY DEFINER so it can write despite `profiles` UPDATE being
-- super-admin-only, but it re-derives the target row from auth.uid() itself
-- (never trusts a caller-supplied id) and validates the value against the
-- same 3-language allow-list as the column check constraint, so it cannot be
-- used to write anything else or to touch another user's row.
create or replace function public.update_my_locale(p_locale text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'update_my_locale: not authenticated';
  end if;
  if p_locale not in ('az', 'en', 'ru') then
    raise exception 'update_my_locale: invalid locale %', p_locale;
  end if;

  update public.profiles
  set locale = p_locale
  where id = auth.uid();
end;
$$;

revoke all on function public.update_my_locale(text) from public;
revoke all on function public.update_my_locale(text) from anon;
grant execute on function public.update_my_locale(text) to authenticated;
