-- ============================================================================
-- MenuFlow — Banner CTA / action system
-- ============================================================================
-- Banners already carry `link_url` (0006_admin_feature_pack.sql) and
-- CustomerApp.jsx already renders one as a real `<a href target="_blank">`
-- when `isSafeUrl(link_url)` passes — external-link banners already work.
-- What's missing is any way to point a banner at something INSIDE the app:
-- a specific product (opens ProductDetailModal) or a specific category
-- (filters the menu), which is the actual "banners are interactive
-- advertisements, not just external links" gap.
--
-- `action_target_id` is a deliberately unconstrained uuid, not a foreign
-- key — it can reference either products.id or categories.id depending on
-- `action_type`, and a real requirement of this feature is resolving it
-- gracefully when the target has since been deleted (an FK constraint would
-- make that a hard delete-time failure instead of a normal, expected runtime
-- case the UI already has to handle). Tenant safety doesn't come from a
-- constraint either: CustomerApp resolves `action_target_id` by looking it
-- up in the restaurant's OWN already-loaded `products`/`categories` arrays
-- (loadMenuData() is restaurant_id-scoped), so a banner pointing at another
-- restaurant's row simply won't be found there — same code path as "target
-- was deleted", both fall back to rendering the banner as non-interactive.
--
-- `action_url` is NOT a new column: 'external' and 'phone' (tel:) both
-- reuse the existing `link_url` column rather than duplicating it under a
-- second name (see CLAUDE.md's "don't create duplicate columns for a
-- frontend naming difference" convention — the same principle applies to
-- two backend names for the same value).
--
-- 'campaign' and generic 'internal' actions from the original request are
-- deliberately NOT included in the action_type enum: CustomerApp has no
-- campaign detail view today (campaigns are an admin-only grouping concept
-- for organizing discounts, never rendered to customers) and no multi-page
-- routing for a generic "internal destination" to mean anything beyond
-- category selection, which is already covered. Adding either now would be
-- inventing a destination screen that doesn't exist — deferred until a real
-- one does.
--
-- Backfill: existing rows all get action_type='none' from the column
-- default, which would make every banner that already has a working
-- link_url silently stop being clickable — that's exactly the "existing
-- banners without an action must continue to work" regression this feature
-- must not cause. The backfill below reclassifies any row that already had
-- a link as 'external', preserving its current behavior.
--
-- Run this after 0018_disable_self_service_onboarding.sql.
-- ============================================================================

alter table public.banners add column if not exists action_type text not null default 'none'
  check (action_type in ('none', 'product', 'category', 'external', 'phone'));

alter table public.banners add column if not exists action_target_id uuid;

comment on column public.banners.action_type is
  'none | product | category | external | phone. product/category resolve action_target_id against this restaurant''s own products/categories; external/phone reuse link_url (external: opened as-is; phone: expected to be a tel: URI).';
comment on column public.banners.action_target_id is
  'products.id or categories.id depending on action_type. No FK on purpose — resolution must already tolerate a deleted/cross-tenant target at read time, see migration header.';

-- Preserve current behavior for every banner that already has a link:
-- isSafeUrl(link_url) in CustomerApp.jsx is what currently makes it
-- clickable, so any such row becomes an explicit 'external' action instead
-- of silently losing that behavior under the new action_type='none' default.
update public.banners
set action_type = 'external'
where action_type = 'none'
  and link_url is not null
  and trim(link_url) <> '';
