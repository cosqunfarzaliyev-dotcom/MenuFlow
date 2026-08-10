-- ============================================================================
-- MenuFlow — optional per-product rating
-- ============================================================================
-- Nullable, additive column: the redesigned customer product card can show
-- a rating badge when one is set, and simply omits it when null — no
-- fabricated data, no impact on existing rows or RLS (already covered by
-- the products_public_read / products_tenant_write policies from
-- 0001_multi_tenant_saas.sql).
-- ============================================================================

alter table public.products add column if not exists rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5));
