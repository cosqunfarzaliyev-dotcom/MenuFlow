-- ============================================================================
-- MenuFlow — Formal plan & subscription system (Master Plan Phase 9)
-- ============================================================================
-- Four separate, normalized structures, as requested:
--   1. Plan Definition          -> public.plans
--   2. Plan Features/Entitlements -> public.plan_features
--   3. Restaurant Subscription  -> public.restaurant_subscriptions
--   4. Restaurant Override      -> public.restaurant_feature_overrides
--
-- Design principle: ADDITIVE, not a rip-and-replace. `restaurants.plan` /
-- `subscription_status` / `trial_ends_at` / `feature_flags` are NOT touched —
-- every existing write path (superAdminService.updateRestaurant/setRestaurant
-- Plan/setRestaurantFeatureFlag, RestaurantsTab.jsx, AdminApp's theme save,
-- createRestaurant) keeps writing to those columns completely unchanged.
-- Two triggers below mirror those columns into the new tables automatically
-- on every INSERT/UPDATE, so the new normalized model is always in sync with
-- zero application code changes required for WRITES. The entitlement
-- resolver and the new /pricing page (see accompanying app changes) become
-- the READERS of the new tables — that's what "adapt existing plan data to
-- this architecture" means here: the data model formally exists in Postgres
-- now, JS constants become a hydration cache/fallback instead of the source
-- of truth.
--
-- Sync direction is one-way (restaurants -> new tables) on purpose: nothing
-- in the app writes to the new tables directly yet (no self-service billing
-- change flow exists — plan/subscription changes are still super-admin-only
-- manual actions, per the D1 account model and the "fully manual billing"
-- reality documented in CLAUDE.md). A future task that adds direct editing
-- of billing_interval/auto_renew/end_date needs the reverse sync (or to
-- retire the old columns outright) — out of scope here.
--
-- Run this after 0020_security_audit_hardening.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Plan Definition
-- ----------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,              -- stable identifier: matches restaurants.plan today ('basic'/'pro'/legacy 'free'/'trial'/'enterprise')
  name text not null,
  description text not null default '',
  price_monthly numeric(10,2) not null default 0,
  price_yearly numeric(10,2) not null default 0,
  currency text not null default 'AZN',
  is_active boolean not null default true,  -- offered on /pricing? legacy plans are false (kept only so old rows still resolve, mirrors components/superadmin/constants.js's existing PLAN_META comment)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Plan Features / Entitlements
-- ----------------------------------------------------------------------------
create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null,   -- matches lib/services/entitlementService.js's FEATURES keys (apple_pay/google_pay/banners); no FK — the JS FEATURE_REGISTRY stays the canonical key catalog + display metadata, same reasoning restaurants.feature_flags already used for loose keys
  enabled boolean not null default false,
  unique (plan_id, feature_key)
);

-- ----------------------------------------------------------------------------
-- 3. Restaurant Subscription — one current-state row per restaurant (not a
--    billing ledger/history table; there's no payment processor generating
--    a real event stream yet, see CLAUDE.md Phase 10). billing_interval and
--    the renewal fields are genuinely new — restaurants.subscription_status
--    never tracked monthly-vs-yearly at all.
-- ----------------------------------------------------------------------------
create table if not exists public.restaurant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  -- 'cancelled' (double-L) here, not restaurants.subscription_status's
  -- 'canceled' — the sync trigger below translates between the two spellings.
  -- 'expired' is new: restaurants.subscription_status never had it (a lapsed
  -- trial was only ever detected dynamically in billingService.isAccessBlocked
  -- by comparing trial_ends_at to now()). It's included here as a real,
  -- settable status for when a subscription's current period has definitely
  -- ended, while lib/services/planService.js's getEffectiveSubscriptionStatus()
  -- still derives it dynamically too (a trialing row past trial_ends_at reads
  -- as effectively expired even before anything writes the literal value) —
  -- belt and suspenders, matching how accessBlockReason() already works.
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  trial_ends_at timestamptz,
  auto_renew boolean not null default true,
  renewed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restaurant_subscriptions_restaurant_id_idx on public.restaurant_subscriptions(restaurant_id);

-- ----------------------------------------------------------------------------
-- 4. Restaurant Override — the normalized form of restaurants.feature_flags
--    (jsonb). One row per (restaurant, feature) instead of a blob, so it's
--    queryable/joinable the same way plan_features is. feature_flags stays
--    the column the app actually writes (see design note above); this table
--    is kept in sync by trigger.
-- ----------------------------------------------------------------------------
create table if not exists public.restaurant_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  unique (restaurant_id, feature_key)
);
create index if not exists restaurant_feature_overrides_restaurant_id_idx on public.restaurant_feature_overrides(restaurant_id);

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.restaurant_subscriptions enable row level security;
alter table public.restaurant_feature_overrides enable row level security;

-- plans / plan_features: public read (an unauthenticated visitor must be
-- able to load /pricing — same reasoning as products/categories/banners
-- being public-read), super_admin-only write (plan catalog is a platform-
-- level concern, not a per-restaurant one).
drop policy if exists "plans_public_read" on public.plans;
create policy "plans_public_read" on public.plans for select using (true);
drop policy if exists "plans_super_admin_write" on public.plans;
create policy "plans_super_admin_write" on public.plans
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "plan_features_public_read" on public.plan_features;
create policy "plan_features_public_read" on public.plan_features for select using (true);
drop policy if exists "plan_features_super_admin_write" on public.plan_features;
create policy "plan_features_super_admin_write" on public.plan_features
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- restaurant_subscriptions / restaurant_feature_overrides: billing-sensitive
-- per-tenant data — that restaurant's own staff/admin (or super_admin) can
-- read it, but only super_admin can write, matching the "manual billing,
-- super-admin-only" reality (restaurants_owner_update never let a
-- restaurant_admin touch plan/subscription_status/trial_ends_at either —
-- protect_restaurant_privileged_fields reverts those; same authority level
-- applies to their normalized form here).
drop policy if exists "restaurant_subscriptions_tenant_read" on public.restaurant_subscriptions;
create policy "restaurant_subscriptions_tenant_read" on public.restaurant_subscriptions
  for select to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "restaurant_subscriptions_super_admin_write" on public.restaurant_subscriptions;
create policy "restaurant_subscriptions_super_admin_write" on public.restaurant_subscriptions
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "restaurant_feature_overrides_tenant_read" on public.restaurant_feature_overrides;
create policy "restaurant_feature_overrides_tenant_read" on public.restaurant_feature_overrides
  for select to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "restaurant_feature_overrides_super_admin_write" on public.restaurant_feature_overrides;
create policy "restaurant_feature_overrides_super_admin_write" on public.restaurant_feature_overrides
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 6. Seed data — mirrors components/superadmin/constants.js's PLAN_META and
--    lib/services/entitlementService.js's PLAN_FEATURE_DEFAULTS exactly, so
--    hydrating the JS layer from these rows (see entitlementService.js's new
--    hydratePlanFeatureDefaults()) is a behavior-neutral swap. Yearly prices
--    are a placeholder "~2 months free" convention (monthly * 10) — no
--    pricing strategy exists anywhere else in this codebase to match
--    against; a super_admin can edit these rows directly (no UI for it yet,
--    same "schema exists, admin UI is separate work" boundary already drawn
--    for entitlement/capability enforcement elsewhere in this project).
-- ----------------------------------------------------------------------------
insert into public.plans (key, name, description, price_monthly, price_yearly, currency, is_active, sort_order)
values
  ('basic', 'Basic', 'Kiçik restoranlar üçün başlanğıc paket', 29, 290, 'AZN', true, 1),
  ('pro', 'Pro', 'Böyüyən restoranlar üçün tam funksionallıq', 79, 790, 'AZN', true, 2),
  ('free', 'Free (legacy)', 'Köhnə pulsuz plan — yeni satışda təklif edilmir', 0, 0, 'AZN', false, 90),
  ('trial', 'Free (legacy)', 'Köhnə sınaq planı — yeni satışda təklif edilmir', 0, 0, 'AZN', false, 91),
  ('enterprise', 'Enterprise (legacy)', 'Köhnə enterprise planı — yeni satışda təklif edilmir', 199, 1990, 'AZN', false, 92)
on conflict (key) do nothing;

do $$
declare
  v_basic_id uuid;
  v_pro_id uuid;
begin
  select id into v_basic_id from public.plans where key = 'basic';
  select id into v_pro_id from public.plans where key = 'pro';

  insert into public.plan_features (plan_id, feature_key, enabled)
  values
    (v_basic_id, 'apple_pay', false),
    (v_basic_id, 'google_pay', false),
    (v_basic_id, 'banners', false),
    (v_pro_id, 'apple_pay', true),
    (v_pro_id, 'google_pay', true),
    (v_pro_id, 'banners', true)
  on conflict (plan_id, feature_key) do nothing;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Backfill any already-existing restaurants into the new tables (a no-op
--    on the current empty database, but correct for a non-empty one — and
--    required so this migration is safe to run again later without a gap).
-- ----------------------------------------------------------------------------
insert into public.restaurant_subscriptions (restaurant_id, plan_id, billing_interval, status, start_date, end_date, trial_ends_at)
select
  r.id,
  coalesce(p.id, (select id from public.plans where key = 'basic')),
  'monthly',
  case r.subscription_status when 'canceled' then 'cancelled' else coalesce(r.subscription_status, 'trialing') end,
  r.created_at,
  r.trial_ends_at,
  r.trial_ends_at
from public.restaurants r
left join public.plans p on p.key = r.plan
on conflict (restaurant_id) do nothing;

insert into public.restaurant_feature_overrides (restaurant_id, feature_key, enabled)
select r.id, kv.key, (kv.value)::boolean
from public.restaurants r,
     jsonb_each_text(coalesce(r.feature_flags, '{}'::jsonb)) as kv(key, value)
on conflict (restaurant_id, feature_key) do nothing;

-- ----------------------------------------------------------------------------
-- 8. Sync triggers — restaurants columns stay the write path; these mirror
--    every write into the normalized tables automatically. SECURITY DEFINER
--    so they bypass the super-admin-only RLS above regardless of who
--    triggered the original restaurants UPDATE (matches the pattern already
--    used by protect_restaurant_privileged_fields, set_table_qr_token, etc.).
-- ----------------------------------------------------------------------------
create or replace function public.sync_restaurant_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_status text;
  v_plan_changed boolean;
begin
  select id into v_plan_id from public.plans where key = new.plan;
  if v_plan_id is null then
    -- Unknown plan key written directly to restaurants.plan (the app only
    -- ever writes 'basic'/'pro', but fail safe rather than let a bad value
    -- block the restaurants write this trigger rides on).
    select id into v_plan_id from public.plans where key = 'basic';
  end if;

  v_status := case new.subscription_status when 'canceled' then 'cancelled' else coalesce(new.subscription_status, 'trialing') end;

  -- TG_OP-gated explicitly rather than `(tg_op = 'INSERT') or (old.plan ...)`
  -- — OLD is unassigned on INSERT, and referencing it unconditionally in a
  -- boolean expression is a hard PL/pgSQL error, not just a null.
  if tg_op = 'INSERT' then
    v_plan_changed := true;
  else
    v_plan_changed := (old.plan is distinct from new.plan);
  end if;

  insert into public.restaurant_subscriptions (
    restaurant_id, plan_id, status, start_date, end_date, trial_ends_at, updated_at
  )
  values (
    new.id, v_plan_id, v_status, now(), new.trial_ends_at, new.trial_ends_at, now()
  )
  on conflict (restaurant_id) do update
  set plan_id = excluded.plan_id,
      status = excluded.status,
      -- A plan change starts a new subscription period; anything else
      -- (status/trial_ends_at only changing) leaves start_date alone.
      start_date = case when v_plan_changed then excluded.start_date else public.restaurant_subscriptions.start_date end,
      end_date = excluded.end_date,
      trial_ends_at = excluded.trial_ends_at,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists restaurants_sync_subscription on public.restaurants;
create trigger restaurants_sync_subscription
  after insert or update of plan, subscription_status, trial_ends_at on public.restaurants
  for each row execute procedure public.sync_restaurant_subscription();

create or replace function public.sync_restaurant_feature_overrides()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete + reinsert rather than diffing added/removed keys — feature_flags
  -- is a small object (3 keys today) and every write already replaces the
  -- whole jsonb value (see setRestaurantFeatureFlag's merge-then-write), so
  -- this stays correct without the extra complexity of a key-level diff.
  delete from public.restaurant_feature_overrides where restaurant_id = new.id;
  insert into public.restaurant_feature_overrides (restaurant_id, feature_key, enabled)
  select new.id, kv.key, (kv.value)::boolean
  from jsonb_each_text(coalesce(new.feature_flags, '{}'::jsonb)) as kv(key, value);
  return new;
end;
$$;

drop trigger if exists restaurants_sync_feature_overrides on public.restaurants;
create trigger restaurants_sync_feature_overrides
  after insert or update of feature_flags on public.restaurants
  for each row execute procedure public.sync_restaurant_feature_overrides();

-- Generic updated_at toucher for direct writes to restaurant_subscriptions
-- (a future super_admin UI editing billing_interval/auto_renew directly,
-- not through the sync trigger above, still gets a correct updated_at).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists restaurant_subscriptions_touch_updated_at on public.restaurant_subscriptions;
create trigger restaurant_subscriptions_touch_updated_at
  before update on public.restaurant_subscriptions
  for each row execute procedure public.touch_updated_at();
