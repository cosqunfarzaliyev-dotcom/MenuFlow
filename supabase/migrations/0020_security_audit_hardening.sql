-- ============================================================================
-- MenuFlow — RLS / tenant-isolation audit hardening
-- ============================================================================
-- Findings from a full audit of every tenant table, RLS policy, helper
-- function, SECURITY DEFINER RPC, and public/customer access path (cross-
-- checked against the live project via the Supabase security advisor,
-- `mcp__supabase__get_advisors(type: 'security')`, not just a manual read of
-- the migration history). Three real findings, all fixed below; everything
-- else audited came back clean — see the accompanying audit note in
-- docs/PROJECT_CONTEXT.md for the full pass/fail list per table.
--
-- 1. [ERROR, advisor lint `security_definer_view`] `public.restaurants_public`
--    (0007_restaurant_privacy_hardening.sql) is a plain VIEW, which in
--    Postgres always runs with its OWNER's privileges and therefore bypasses
--    RLS on `restaurants` unconditionally — that bypass was the *intended*
--    mechanism in 0007 (comment there says so explicitly), but it means the
--    view's column list is the ONLY thing standing between anon and every
--    column on `restaurants` (including `plan`/`subscription_status`/
--    `trial_ends_at`/`feature_flags`) — a future `select *` edit to the view
--    would silently leak them with no RLS to catch it. Fixed by replacing the
--    view with a SECURITY DEFINER *function* that explicitly enumerates the
--    safe columns in its body, exactly the pattern this schema already uses
--    for `get_restaurant_qr_tokens()`/`get_platform_users()` — same bypass
--    mechanism, but the safe column list is a code-reviewed statement instead
--    of an implicit property of "it's a view". Behavior is unchanged: same
--    columns, same `is_active = true` filter, callable by anon AND
--    authenticated (a logged-in restaurant_admin/staff of a DIFFERENT
--    restaurant must still be able to open any restaurant's public QR menu —
--    `/menu/[restaurant]/[table]` has no auth gate at all, so this can't be
--    narrowed to "authenticated -> only their own restaurant" without
--    breaking that). Paired app change: lib/services/authService.js's
--    fetchRestaurantBySlug() now calls this RPC instead of querying the view.
--
-- 2. [WARN, advisor lint `anon_security_definer_function_executable`]
--    `price_order_item()` (0013_secure_order_pricing.sql) was documented in
--    its own comment as "Not exposed to anon/authenticated directly — only
--    called from inside place_order()", but no migration ever actually
--    revoked EXECUTE — Postgres grants EXECUTE on a new function to PUBLIC by
--    default unless revoked, so the stated intent silently never took effect
--    and anon/authenticated could call it directly via
--    /rest/v1/rpc/price_order_item the whole time. Impact is low (it only
--    ever returns a price computed from already-publicly-readable
--    `products`/`discounts` rows, no side effects), but the enforcement
--    should match the documented intent. `place_order()` keeps working
--    unaffected: SECURITY DEFINER functions execute nested calls as their
--    OWNER, not as the original caller, so revoking EXECUTE from anon/
--    authenticated doesn't touch place_order()'s ability to call it.
--
-- 3. [WARN, advisor lint `anon_security_definer_function_executable`, same
--    root cause as #2] The four RLS helper functions (`is_super_admin()`,
--    `current_role_name()`, `current_restaurant_id()`, `is_staff_of()`,
--    0001_multi_tenant_saas.sql) are also PUBLIC-executable by default.
--    `authenticated` genuinely needs EXECUTE on all four — nearly every
--    tenant-write/read policy in this schema calls one of them, and a
--    policy's function calls are checked against the QUERYING role's own
--    privileges, not the table owner's. `anon` never legitimately needs to
--    call any of them directly (no `to public`/anon-scoped policy in this
--    schema calls any of the four — confirmed against live pg_policies, not
--    just the migration source), and each one is a no-op/returns
--    false-or-null for an anonymous caller anyway (auth.uid() is null, so
--    every underlying `profiles` lookup matches zero rows) — so this is
--    defense-in-depth, not a fix for an actual leak, but it closes 4 of the
--    advisor's WARN findings for free with zero behavior change.
--
-- Also included: `audit_logs_tenant_insert`'s WITH CHECK only verified
-- `is_staff_of(restaurant_id)` (0006_admin_feature_pack.sql), never that the
-- row's own `actor_id` matches the caller — any staff member could insert an
-- audit-log row attributing an action to a DIFFERENT user (or a fabricated
-- one) within their own tenant, undermining the "kim / nə vaxt" accountability
-- the audit log exists for. Not a tenant-isolation break (restaurant_id is
-- still correctly scoped), but a real actor-spoofing gap within one tenant.
-- The client (lib/store.js recordAudit()) already always sets actor_id from
-- the CURRENT session's own profile.id, so this closes cleanly with no app
-- change required.
--
-- Run this after 0019_banner_actions.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. restaurants_public: view -> SECURITY DEFINER function
-- ----------------------------------------------------------------------------
create or replace function public.get_public_restaurant(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  logo text,
  tagline text,
  currency_symbol text,
  table_count int,
  theme_primary_color text,
  theme_secondary_color text,
  is_active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id, r.slug, r.name, r.logo, r.tagline, r.currency_symbol, r.table_count,
    r.theme_primary_color, r.theme_secondary_color, r.is_active, r.created_at
  from public.restaurants r
  where r.slug = p_slug and r.is_active = true;
$$;

grant execute on function public.get_public_restaurant(text) to anon, authenticated;

revoke select on public.restaurants_public from anon, authenticated;
drop view if exists public.restaurants_public;

-- ----------------------------------------------------------------------------
-- 2. price_order_item(): enforce the "internal only" intent already
--    documented in 0013 but never actually applied.
-- ----------------------------------------------------------------------------
revoke execute on function public.price_order_item(uuid, uuid, jsonb) from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- 3. RLS helper functions: anon never needs these directly; authenticated
--    still does (policies throughout this schema call them).
-- ----------------------------------------------------------------------------
revoke execute on function public.is_super_admin() from anon;
revoke execute on function public.current_role_name() from anon;
revoke execute on function public.current_restaurant_id() from anon;
revoke execute on function public.is_staff_of(uuid) from anon;

-- ----------------------------------------------------------------------------
-- 4. audit_logs: actor_id must match the caller (or be null), so a staff
--    member can no longer attribute an action to someone else.
-- ----------------------------------------------------------------------------
drop policy if exists "audit_logs_tenant_insert" on public.audit_logs;
create policy "audit_logs_tenant_insert" on public.audit_logs
  for insert to authenticated
  with check (
    public.is_staff_of(restaurant_id)
    and (actor_id is null or actor_id = auth.uid())
  );
