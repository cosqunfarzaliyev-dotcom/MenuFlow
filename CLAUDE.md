# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Persistent context / token-efficiency protocol

The conversation context is temporary. Project state must survive context resets through repository files.

### CONTEXT CONTINUATION RULE

When a new conversation/session starts, read **only** `CLAUDE.md` (this file) and [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) before doing anything else. `PROJECT_CONTEXT.md` carries the stack, architecture map, per-system status table, current Master Plan phase, and task history — treat it as the living summary and this file as the detailed reference behind it. If those two files give enough context for the requested task, **do not re-read the rest of the repository.** Only inspect additional files that are directly relevant to the current task.

### Mandatory session startup

At the beginning of a new Claude Code session:

1. Read this `CLAUDE.md`.
2. Read `docs/PROJECT_CONTEXT.md`.
3. Inspect only files directly relevant to the current task.

**Do NOT perform a full repository scan merely because the previous conversation context was lost or a new session was opened.**

Broaden repository inspection only when:
- the current task explicitly requires architecture discovery;
- persistent documentation is insufficient or stale; or
- targeted inspection reveals a dependency that must be understood before making a safe change.

### Mandatory task handoff

After completing a task, update `docs/PROJECT_CONTEXT.md`'s **Task history** and **Working tree at last context sync** sections with the concise handoff state: what changed, files touched, migrations added, decisions made, validation run, and known issues. Update this file's Master Plan status table only when a phase change is genuinely implemented and verified — don't let the two files' status claims drift apart.

The goal is to make a context reset cheap: a new session should recover project state from these files and continue from the current task without rereading unrelated parts of the repository.

> Note: earlier drafts of this protocol referenced `docs/DEVELOPMENT_STATE.md`, `docs/DECISION_LOG.md`, and `docs/TASK_QUEUE.md`. Those files were never created — `docs/PROJECT_CONTEXT.md` (created 2026-08-11) supersedes them as the single persistent-state file. If task sequencing or a decision log becomes genuinely necessary, create the specific file then and link it from `PROJECT_CONTEXT.md` rather than reviving these names speculatively.

## Commands

```bash
npm install          # node_modules is NOT checked in
npm run dev          # next dev — Turbopack, port 3000
npm run build        # next build --webpack
npm run lint         # eslint .
node scripts/verify-order-subscription.mjs   # order/table realtime filter check
node scripts/verify-entitlements.mjs         # feature-entitlement precedence chain check
node scripts/verify-capabilities.mjs         # role-capability matrix check
node scripts/verify-plans.mjs                # plan-feature hydration (DB -> entitlement resolver) check
```

- There is **no test framework** (no jest/vitest/playwright). The `scripts/verify-*.mjs` files are standalone assertion scripts that exit non-zero on failure; they are the closest thing to a test. New logic-level checks should follow that pattern (plain `.mjs`, `process.exit(1)` on failure) unless the user asks for a real test runner. A plain `.js` service with no relative imports (e.g. `lib/services/entitlementService.js`) can be imported directly from a `.mjs` script despite the repo having no `"type": "module"` — Node 24 auto-detects the ESM `export` syntax and reparses (one harmless stderr warning, exit code unaffected).
- **`npm run build` uses `--webpack`, not Turbopack** (`package.json`); `npm run dev` still uses Turbopack (the Next 16 default). `next.config.ts` no longer sets `output: 'standalone'` or any `turbopack`/`webpack`/`eslint` key — those were removed together when the build was switched to `--webpack` for Vercel (commit `3a3f609`). `npm start` (`next start`) works normally now; the older `output: 'standalone'` → "use `node .next/standalone/server.js` instead" caveat no longer applies. Because dev and build use different bundlers, verify any CSS/asset-sensitive change under **both**.
- Both `bun.lock` and `package-lock.json` exist; `npm install` is what has actually been run. Installed version is **Next 16.3.0**.
- ESLint config is duplicated in `eslint.config.mjs` (flat, used by ESLint 9) and legacy `.eslintrc.json`.

### Next 16 specifics

This project was written for Next 15 and upgraded; several Next 16 behaviors bite here:

- **Turbopack's CSS parser is strict about `@import` ordering** (dev only, but keep it correct regardless since dev is where this breaks). In `app/globals.css` the Google Fonts `@import` must stay *above* `@import "tailwindcss"` — Tailwind gets inlined in place, and any `@import` after it no longer "precedes all rules", which fails the whole stylesheet and 500s every route in dev. Any new `@import` goes above the Tailwind line, and any new global CSS block goes at the very end of the file (see the `prefers-reduced-motion` block) so it can never affect this ordering.
- The `eslint: { ignoreDuringBuilds: true }` key was **removed** from `next.config.ts` during the Next 16 upgrade: Next 16 dropped it from the `NextConfig` type, and `typescript.ignoreBuildErrors: false` turned that into a build-failing `TS2353`. It was already a runtime no-op — `next build` no longer runs ESLint at all, so lint is strictly a separate step (`npm run lint`) and **nothing gates it**.
- `middleware.js` triggers a deprecation warning (Next wants `proxy`). It still works — don't migrate it casually, since it is the server-side role gate.
- `next dev` **appends a `nextjs-agent-rules` block to this file on every run** (`node_modules/next/dist/server/lib/generate-agent-files.js`). It regenerates if deleted; leave it in place and commit it with your changes.

Running the app without `.env.local` is fine — `lib/supabase.js` falls back to a no-op client and the customer menu renders the `data/menu.json` seed data. Expect `Supabase client not ready` realtime warnings in that mode; they are handled, not bugs.

### Local Supabase project

`.env.local` points at a real Supabase project (`MenuFlow`, `eu-central-1`, free tier — org `cosqunfarzaliyev-dotcom's Org`) with all 26 migration files (`0000`–`0024`, minus the unapplied second `0017` — see below) applied via the Supabase MCP server, in order. It has the schema but **no seed data** in the tenant tables — every `restaurants`/`orders`/etc. row is empty, so the customer menu still shows `data/menu.json` (the store's empty-array fallback), which is expected, not a bug. `plans`/`plan_features` (added `0021`) **are** seeded (5 plans, 6 feature rows) — see **Plan & subscription system** below.

- Applying a migration through the MCP/SQL-editor path bypasses PostgREST's schema cache. If the app throws `PGRST205: Could not find the table 'public.x' in the schema cache` right after a migration, run `NOTIFY pgrst, 'reload schema';` (`execute_sql`) rather than assuming the migration failed.
- No super_admin exists yet. To get one: sign up through `/login` (Qeydiyyat) with a real email, then promote that profile with `update public.profiles set role = 'super_admin' where email = '...'`. There is no self-serve path anymore — self-service tenant/onboarding creation is revoked (D1, migration `0018`; see Roles above), so a freshly-signed-up user landing on `/onboarding` only ever sees the "pending activation" screen (or, once assigned by a super admin, the post-activation setup wizard) — never a restaurant-creation form.
- `supabase/all_migrations_combined.sql` was **not** what was run — the individual migration files were applied directly. Keep using the individual files as the source of truth for this project too.

### Lint baseline

`npm run lint` currently reports **18 problems (14 errors, 4 warnings)**, all pre-existing and all from the React Compiler rules that `eslint-config-next` 16 turned on:

- 13 × `react-hooks/set-state-in-effect` — the Supabase session-sync effects in `app/login`, `app/onboarding`, `app/reset-password`, `AdminApp`, `StaffApp`, `SuperAdminApp`, `DesignTab`, `RestaurantsTab`
- 1 × `react-hooks/purity` — `Date.now()` during render in `superadmin/UsersTab.jsx:82`
- 4 × `react-hooks/exhaustive-deps` (warnings) — `CustomerApp`, `StaffApp`

None of these break the build or runtime. Fixing them means restructuring auth/session effects, which is security-relevant code — treat it as its own reviewed task, not incidental cleanup. When adding code, don't add *new* violations.

## Architecture

### There is no backend

The browser talks to Supabase directly with the publishable/anon key. There are no API routes, no server actions, no service-role key anywhere. Everything that would normally be "backend" lives in Postgres:

- **RLS policies** are the authorization layer.
- **`SECURITY DEFINER` RPCs** are the write layer for anything that can't be trusted to the client (`place_order`, `upsert_alert`, `create_restaurant_self_service`, `get_restaurant_qr_tokens`, `get_platform_users`, `verify_qr_token`, `get_public_restaurant`).
- **`BEFORE INSERT` triggers** are the rate limiter and the privileged-field guard. **`AFTER INSERT OR UPDATE` triggers** (`0021`) mirror `restaurants` columns into the newer normalized plan/subscription tables — see **Plan & subscription system** below.

Consequence: *any* new security rule must land in a migration. Client-side checks in this repo are UX, not security.

### Four surfaces, four root components

| Route | Component | Audience |
|---|---|---|
| `/menu/[restaurant]/[table]?t=<qr-token>` | `components/CustomerApp.jsx` | unauthenticated customer |
| `/staff` | `components/StaffApp.jsx` | `staff`, `restaurant_admin` |
| `/admin` | `components/AdminApp.jsx` (2000+ lines, all tabs inline) | `restaurant_admin` |
| `/superadmin` | `components/SuperAdminApp.jsx` + `components/superadmin/*` | `super_admin` |

`app/*/page.jsx` files for the four surfaces above are thin `"use client"` wrappers. `/stuff` redirects to `/staff`.

### Public marketing site

`/`, `/features`, `/faq`, `/demo`, `/contact`, and `/pricing` are the public marketing site — unauthenticated, not covered by middleware (its matcher only lists `/admin`/`/staff`/`/superadmin`/`/onboarding`). `app/page.jsx` used to be a legacy role-switcher rendering Admin/Staff/Customer from a `?role=` query param; that's gone — `/` is now the real marketing homepage, and `CustomerApp` is only reachable via `/menu/[restaurant]/[table]`. Every marketing route shares `components/marketing/MarketingHeader.jsx`/`MarketingFooter.jsx` (nav + `LanguageSwitcher` + login/signup CTAs, hamburger below the `lg` breakpoint — the full nav row doesn't fit at `md`) and is written as a self-contained `page.jsx` (content inline, not a big imported component — the convention `/pricing` established first). `components/marketing/PhoneShowcase.jsx` (used on `/` and `/demo`) renders the real `ProductCard` component against real seed data (`data/menuData.js`) inside a phone-frame mock, not a fabricated screenshot. `/contact` has no submit form — there's no backend to receive one — just a `wa.me` link and a `mailto:` link (the same WhatsApp placeholder number `AdminApp.jsx` already used for its subscription CTA).

`AdminApp.jsx`/`StaffApp.jsx`'s "Müştəri Menyusu" links had to change when `/` stopped being the customer menu: they now go to `restaurant?.slug ? \`/menu/${restaurant.slug}\` : '/'` — their own restaurant's real menu, not the marketing homepage.

### Roles

Canonical role strings (from `profiles.role`, `lib/services/authService.js` `ROLES`):
`super_admin` | `restaurant_admin` | `staff` | `unassigned`

Note this is **`restaurant_admin`, not `admin`** — some of the older markdown docs in the repo get this wrong.

`middleware.js` runs on `/admin`, `/staff`, `/superadmin`, `/onboarding`. It calls `supabase.auth.getUser()` (revalidates the token server-side, unlike `getSession()`), reads `profiles.role`, and redirects to the role's home. This works only because `lib/supabase.js` uses `@supabase/ssr`'s `createBrowserClient`, which stores the session in **cookies** — do not swap it for a localStorage-backed client.

New signups get `role: 'unassigned'` via the `on_auth_user_created` trigger. **Account model is super-admin-only (Master Plan D1, "Yol A", migration `0018`):** signing up creates a *login* only — it never creates a restaurant. An `unassigned` user becomes a `restaurant_admin` **only** when a super admin creates a restaurant and assigns them by email in the SuperAdmin panel (`superAdminService.assignUserToRestaurant`). Self-service onboarding is disabled: `0018` revokes `execute` on `create_restaurant_self_service` from `authenticated`/`anon` (the function body is kept, not dropped), and `billingService.createRestaurantSelfService` is deprecated with no live caller. Do not re-enable self-serve tenant creation without an explicit decision to change this model — the post-activation wizard below does **not** create a restaurant, it only fills in one that already exists.

**`app/onboarding/page.jsx` now branches on role, not a single static screen.** `unassigned` still gets the original "pending activation" screen (nothing to do but wait). A `restaurant_admin` whose restaurant hasn't finished setup gets `components/onboarding/OnboardingWizard.jsx` — an 8-step wizard (Restaurant info → Branding → Language → Currency → Contact → Tables → Initial menu → Design → Completion) that reuses the exact same store actions/services the `/admin` panel itself uses (`updateRestaurantDesign`, `createProduct`, `createCategory`, `updateTableName`, …) rather than a parallel write path; it does not create the restaurant, only edits the one already assigned. Completion writes `restaurants.onboarding_completed_at` (migration `0024_onboarding_completion.sql`, which also added `restaurants.phone`/`.address` for the wizard's Contact step). `middleware.js` enforces the gate server-side, not just via the wizard's own UI flow: a `restaurant_admin` is redirected `/admin` → `/onboarding` while `onboarding_completed_at` is null, and `/onboarding` → `/admin` once it's set — see the middleware source for the exact query. Restaurants that existed before `0024` were backfilled to `onboarding_completed_at = created_at` so no already-active admin gets bounced into the wizard retroactively.

### Tenant resolution — two different paths

Every query is scoped by `restaurant_id`, and there are exactly two ways the current restaurant is resolved:

1. **Customer**: URL slug → `fetchRestaurantBySlug()` → calls the **`get_public_restaurant(p_slug)` RPC** (branding columns only, `is_active = true` filter baked in). This RPC **replaced** the original `restaurants_public` VIEW in migration `0020` (the view was a Supabase-advisor-flagged ERROR: a bare view always bypasses RLS via its owner's privileges, with no code-reviewed statement of which columns that's safe for — a function's explicit `select` list is the same bypass mechanism without that footgun). Never query the base `restaurants` table from an unauthenticated context — it is RLS-locked and carries billing fields.
2. **Admin/Staff/SuperAdmin**: session → `profiles.restaurant_id` → `fetchRestaurantById()` → full `restaurants` row.

### `lib/store.js` is the single data-access funnel

One Zustand store (not persisted). Every mutating action follows the same shape: read `restaurant.id` from the store, call the matching function in `lib/services/*`, then **re-fetch the whole collection** rather than patching local state, then optionally `recordAudit(...)`. Match this pattern when adding actions — components never call `lib/services/*` mutations directly.

`lib/store.js` also holds `qrToken` (from `?t=`), which `createOrder`/`createAlert` pass through to the RPCs.

Service split:
- `supabaseService.js` — products, categories, tables, orders, alerts (+ row normalizers that convert snake_case rows into the camelCase shapes components expect)
- `authService.js` — profile + restaurant resolution, `ROLES`
- `superAdminService.js` — tenants, feature flags, user assignment, and restaurant-level plan/subscription-status changes (`setRestaurantPlan`, `markRestaurantActive`, etc. — all write `restaurants` columns)
- `planService.js` — Plan Definition/Plan Features (`plans`/`plan_features` tables, read **and** write) plus the handful of Restaurant Subscription fields with no `restaurants`-column equivalent (`billing_interval`, `auto_renew`, `renewed_at`, `cancelled_at`, the `expired` status). See **Plan & subscription system** below.
- `billingService.js` — trial math, `isAccessBlocked()` / `accessBlockReason()`
- `promotionsService.js` — banners, campaigns, discounts, audit log, `applyDiscounts()`
- `paymentService.js` — W3C Payment Request API wallet sheet (**collects a token only; nothing is ever charged** — no processor is wired up)
- `realtime.js` — the realtime manager

### Realtime

`lib/services/realtime.js` is a module-level singleton `RealtimeManager`: one channel per `table:restaurantId` key, handler dedupe, exponential backoff, `online`/`offline` reconnect, and a `restaurant_id=eq.<id>` postgres filter when a `restaurantId` is passed. Always pass `{ restaurantId }`.

`supabaseService.js` also exports older `subscribeToOrders/Alerts/...` helpers that create **unfiltered** channels. Nothing imports them anymore; prefer `realtime.js` and don't add new callers of the old ones.

Realtime filtering is a bandwidth optimization — the actual isolation comes from RLS on SELECT.

## Security invariants — do not weaken these

Each one exists because it closed a specific, documented hole. The migration headers explain the exact attack; read them before touching the area.

- **Order pricing is server-side only** (`0013`). `place_order()` recomputes every line price from `products.price` + that product's own `options[].choices[].extraPrice` + live `discounts`. The client sends only product id, quantity, note, and chosen option names. The direct INSERT policies on `orders`/`order_items` were **dropped** — inserting directly will fail closed. `createOrder()` still accepts a `total` argument for compatibility and deliberately ignores it.
- **QR tokens are HMACs** (`0008`). `restaurant_tables.qr_token = hmac(restaurant_id:table_id, secret)`, secret in `public.app_secrets` (revoked from `anon`/`authenticated`). The column is hidden by column-level grants; the admin QR tab gets tokens only through `get_restaurant_qr_tokens()`. `verify_qr_token()` gates order/alert creation. Regenerating tokens invalidates every printed QR code.
- **`upsert_alert()` re-verifies the token itself** (`0012`). `SECURITY DEFINER` functions bypass RLS, so any such function must repeat the checks the dropped policy used to do. Apply this rule to every new RPC.
- **`protect_restaurant_privileged_fields()` trigger** (`0006`, extended in `0016`) silently reverts `slug`, `plan`, `subscription_status`, `trial_ends_at`, `is_active`, `feature_flags` unless the caller is a super admin. RLS is row-level, not column-level — a `restaurant_admin` can legitimately UPDATE their own row, so column protection has to be a trigger. Any new privileged column must be added here.
- **`profiles` UPDATE is super-admin only** (`0003`). The original self-update policy let anyone set their own `role = 'super_admin'`.
- **`update_my_locale(p_locale)` RPC** (`0023`) is the one narrow exception to that lockout — a plain client UPDATE to `profiles.locale` would fail closed under the rule above, so persisting a user's language choice needed a `SECURITY DEFINER` RPC that re-derives `auth.uid()` itself (never trusts a caller-supplied id) and validates `p_locale` against a 3-value allow-list, same "re-verify inside the function" pattern as `upsert_alert()`. It can only ever touch that one column on the caller's own row — don't widen it into a general self-update path.
- **Rate limits** on order/alert INSERT, per-table and per-restaurant (`0002`, `0015`).
- **`get_public_restaurant(p_slug)` RPC** (`0020`, replacing `0007`'s `restaurants_public` view) is the only anon-readable projection of `restaurants`. Same column list and `is_active = true` filter as before — see Tenant resolution above for why it's a function now, not a view.
- **`audit_logs` INSERT requires `actor_id = auth.uid()` (or null)** (`0020`). The original `0006` policy only checked `is_staff_of(restaurant_id)`, so any staff member could write an audit-log row attributing an action to a *different* user within their own tenant — not a tenant-isolation break, but it undermined the log's "kim / nə vaxt" accountability purpose. `lib/store.js`'s `recordAudit()` already always sends the caller's own `profile.id`, so this closed with no app change.
- **`price_order_item()` and the four RLS helper functions (`is_super_admin`/`current_role_name`/`current_restaurant_id`/`is_staff_of`) have `anon` EXECUTE revoked** (`0020`). `price_order_item` was already documented as "internal only" but the revoke was never actually applied until this audit; the helpers are called from inside `authenticated`-scoped RLS policies (which still need EXECUTE — only `anon` was revoked) and are no-ops for an anonymous caller anyway (`auth.uid()` is null), so this is defense-in-depth, not a fix for an actual leak.

Avoid `using (true)` / `with check (true)` on anything tenant-scoped. Note that `products`, `categories`, `restaurant_tables`, `banners`, `campaigns`, `discounts` intentionally have public SELECT — the customer menu is unauthenticated.

A full RLS/tenant-isolation audit (every tenant table, every SELECT/INSERT/UPDATE/DELETE policy, the four RLS helpers, every `SECURITY DEFINER` RPC, public/customer access paths) was run against the **live** project via `mcp__supabase__get_advisors(type: 'security')` cross-checked with `pg_policies`/`information_schema` — not just a read of the migration files — on 2026-08-11. The four findings above (one `ERROR`, two `WARN`-category, one logic gap the advisor doesn't check for) were the only real issues; everything else audited came back clean. Fixed and verified live (advisor re-run showed zero new findings, a functional INSERT/UPDATE smoke test against a temporary restaurant row confirmed the fixes work end-to-end, test data cleaned up). Re-run the advisor after any future migration — it catches exactly this class of mistake immediately, cheaply.

## Database & migrations

- Migrations live in `supabase/migrations/NNNN_name.sql`. There is no Supabase CLI setup, no `supabase/config.toml`, no local DB — this project's actual applied-migration workflow is the Supabase MCP server (`apply_migration`), confirmed by `list_migrations` on the live project matching the file history exactly: write the file first (source of truth, reviewable), apply it via MCP, then verify with `get_advisors` (security). Never assume a migration has been run; when a change needs one, say so explicitly.
- Every migration is written to be re-runnable (`if not exists`, `create or replace`, `drop policy if exists`).
- Add new work as the next `NNNN_` file. Do not edit historical migrations.
- `supabase/all_migrations_combined.sql` is a convenience bundle that **stops at 0013** — it does not include 0014 onward. Treat the individual files as authoritative and update the bundle only if the user asks.
- Migration comments are unusually detailed (attack description, impact, fix, ordering). Keep that style.
- **Two files share the `0017` prefix** — `0017_fix_product_and_order_schema.sql` (applied) and `0017_fix_profiles_self_update_escalation.sql` (**tracked in git, never applied** — confirmed against the live DB's migration history, which jumps `0016` → `0017_fix_product_and_order_schema` → `0018`). Do not apply the second file as-is: despite its name, it **re-creates** a `profiles_self_update` policy that `0003_billing_self_service.sql` deliberately dropped in favor of super-admin-only updates (the original `profiles_self_update` had no `with check`, letting any user set their own `role = 'super_admin'`). Because Postgres OR's permissive policies together, restoring that policy — even with the new file's `with check` guard — widens `profiles` UPDATE access back toward self-service, the opposite of `0003`'s fix. If this needs to be applied, it needs a new number and a re-review, not a silent `0017` re-run.

Core tables: `restaurants`, `profiles`, `categories`, `products`, `restaurant_tables`, `orders`, `order_items`, `alerts`, `banners`, `campaigns`, `discounts`, `audit_logs`, `app_secrets`, `plans`, `plan_features`, `restaurant_subscriptions`, `restaurant_feature_overrides` (the last four added in `0021`, see **Plan & subscription system** below).
RLS helpers: `is_super_admin()`, `is_staff_of(restaurant_id)`, `current_role_name()`, `current_restaurant_id()`.

- **`0020_security_audit_hardening.sql`** — see **Security invariants** above for the four findings it fixed (`get_public_restaurant()` replacing the `restaurants_public` view, `audit_logs` actor-spoof close, `price_order_item`/RLS-helper `anon` EXECUTE revokes).
- **`0021_plan_subscription_system.sql`** + **`0022_fix_touch_updated_at_search_path.sql`** — added the four Plan/Subscription tables and their sync triggers; `0022` is a same-session follow-up fixing a `search_path`-mutable finding the advisor caught on `0021`'s `touch_updated_at()` function immediately after applying it. See **Plan & subscription system** below for the full design (this is the one place in this file where a migration's *design rationale*, not just its existence, matters enough to need its own section — read that before touching `plans`/`plan_features`/`restaurant_subscriptions`/`restaurant_feature_overrides`).
- **`0023_profile_locale.sql`** — `profiles.locale` + the `update_my_locale()` RPC (see Security invariants above and Localization below).
- **`0024_onboarding_completion.sql`** — added `restaurants.phone`, `.address`, `.onboarding_completed_at` for the post-activation setup wizard (see Roles above). Backfilled `onboarding_completed_at = created_at` for every pre-existing row. None of the three columns were added to `protect_restaurant_privileged_fields()` — they're not billing/tenant-identity fields, a `restaurant_admin` is meant to set them on their own row, same as `name`/`tagline`/`logo` already were.

## Subscriptions & feature flags

Billing is **fully manual** — no gateway, no webhooks, no recurring charges. Super admin sets `plan` / `subscription_status` / `trial_ends_at` from the Restaurants tab (or, since `0021`, more detail from the **Planlar** tab / a restaurant's **Abunəlik təfərrüatları** panel — see **Plan & subscription system** below); the helpers in `superAdminService.js` (`markRestaurantActive`, `extendRestaurantTrial`, …) are just wrappers over `updateRestaurant`.

Plans: `basic` | `pro` (`PLAN_ORDER` in `components/superadmin/constants.js`, still hardcoded and still the source `RestaurantsTab.jsx`'s plan-change dropdown reads — **not** yet switched to read the `plans` table live, see below). `free`/`trial`/`enterprise` are legacy labels kept only so old rows render.

`isAccessBlocked(restaurant)` in `billingService.js` is the single gate every panel checks; it returns true for `is_active === false`, an expired trial, or `past_due`/`canceled`, and Admin/Staff render a lock screen instead of the panel. This still reads `restaurants.subscription_status` directly, unaffected by `0021` — see below for why plan/status changes deliberately keep going through this column rather than the newer tables.

### Plan & subscription system

Migration `0021_plan_subscription_system.sql` added four normalized tables **alongside** (not replacing) `restaurants.plan`/`subscription_status`/`trial_ends_at`/`feature_flags`:

| Structure | Table | Purpose |
|---|---|---|
| Plan Definition | `plans` | `key`/`name`/`description`/`price_monthly`/`price_yearly`/`currency`/`is_active`/`sort_order`. Seeded: `basic` (29/290 AZN), `pro` (79/790 AZN), plus `free`/`trial`/`enterprise` as `is_active: false` legacy rows so old data still resolves. |
| Plan Features/Entitlements | `plan_features` | `plan_id` + `feature_key` + `enabled`. Seeded to exactly match `entitlementService.js`'s hardcoded `PLAN_FEATURE_DEFAULTS` (basic: all off; pro: all on) — see below for how the two stay in sync. |
| Restaurant Subscription | `restaurant_subscriptions` | One current-state row per restaurant (not a billing ledger — no payment processor exists to generate a real event stream, see Phase 10). `billing_interval` (`monthly`\|`yearly`) and `auto_renew`/`renewed_at`/`cancelled_at` are genuinely new — `restaurants` never tracked these. `status` adds a 5th value, `expired`, that `restaurants.subscription_status`'s check constraint (`0003`) never included. |
| Restaurant Override | `restaurant_feature_overrides` | Normalized form of `restaurants.feature_flags` — one row per `(restaurant_id, feature_key)` instead of a jsonb blob. |

**Sync is one-way, `restaurants` → new tables, via two `AFTER INSERT OR UPDATE` triggers** (`sync_restaurant_subscription` on `plan`/`subscription_status`/`trial_ends_at`; `sync_restaurant_feature_overrides` on `feature_flags`). This means:

- **Every existing write path keeps working unchanged.** `setRestaurantPlan`/`markRestaurantActive`/`markRestaurantPastDue`/`cancelRestaurantSubscription`/`extendRestaurantTrial`/`setRestaurantFeatureFlag` (all in `superAdminService.js`) still write the `restaurants` columns; the triggers mirror the result into `restaurant_subscriptions`/`restaurant_feature_overrides` automatically. `billingService.isAccessBlocked()` and everything else that reads `restaurants` directly is unaffected and unaware the new tables exist.
- **Plan changes and active/trialing/past_due/cancelled status changes still MUST go through those `superAdminService.js` functions**, not a direct write to `restaurant_subscriptions.plan_id`/`.status` — routing around the trigger would make the new tables' view of "current status" silently diverge from what `isAccessBlocked()` actually gates access on. `RestaurantSubscriptionPanel` (in `RestaurantsTab.jsx`) and `PlansTab.jsx` both respect this.
- **`lib/services/planService.js` writes directly to `restaurant_subscriptions` ONLY for the fields the trigger's `ON CONFLICT DO UPDATE` clause never touches**: `billing_interval`, `auto_renew`, `renewed_at`, `cancelled_at`, and the `expired` status value (which has no `restaurants.subscription_status` equivalent to derive it from at all). This was verified live, not just reasoned about: a temporary restaurant had these fields set directly, then its `subscription_status` was changed through the old-column path (firing the trigger again) — the direct-write fields survived untouched. If you add a new field to `restaurant_subscriptions`, check the trigger body before deciding whether it's safe to write directly or needs to go through `restaurants` instead.
- `planService.js` also owns `plans`/`plan_features` reads **and writes** (`createPlan`/`updatePlan`/`upsertPlanFeature`) — there's no `restaurants`-column equivalent for platform-level catalog data, and RLS already lets `is_super_admin()` write these tables directly. No `deletePlan()` — retiring a plan is `is_active: false` (same convention as `restaurants`/`banners`/`campaigns`/`discounts`), not a hard delete (which `restaurant_subscriptions.plan_id`'s FK would block anyway if the plan's still referenced).

**`/pricing` (`app/pricing/page.jsx`, part of the now-complete Phase 2/E public marketing site — see Architecture above) and the entitlement resolver read from the exact same source.** `entitlementService.js`'s `hydratePlanFeatureDefaults(planFeatureRows)` mutates the existing `PLAN_FEATURE_DEFAULTS` object in place (per-plan-key, per-feature-key merge, not a wholesale replace) from live `plan_features` rows — `lib/store.js`'s `loadPlans()` action calls it once after fetching `plans`+`plan_features` via `planService.js`, and is wired into `CustomerApp`/`AdminApp`/`SuperAdminApp`'s mount effects. `hasFeature()`/`getEntitlements()` keep their exact original synchronous signature throughout — the hardcoded object is now the *fallback/initial* value (used before the fetch resolves, or if Supabase isn't configured), not the permanent source of truth. `/pricing` itself calls `planService.fetchPlans()`/`fetchPlanFeatures()` directly — same functions, so provably the same data, not a second copy that can drift.

**SuperAdmin UI**: a new **Planlar** sidebar tab (`components/superadmin/PlansTab.jsx`) is full CRUD over `plans`/`plan_features` (list, create/edit including monthly+yearly price and active/inactive, per-plan feature-toggle grid). `RestaurantsTab.jsx`'s restaurant-edit modal gained a `RestaurantSubscriptionPanel` (billing interval, auto-renew, mark-expired, mark-renewed, cancelled-at stamp) **alongside**, not replacing, the pre-existing `RestaurantControlsPanel` Switches (Aktiv/Sınaq/Abunəlik Aktiv/Past Due, which still drive the `restaurants` columns exactly as before).

**Not done**: `PLAN_META`/`PLAN_ORDER` in `components/superadmin/constants.js` are still hardcoded, not hydrated from the `plans` table — they're kept numerically consistent with the seed data by convention, not by a live read. `RestaurantsTab.jsx`'s plan-change `<select>` still reads `PLAN_ORDER`, not `plans`. Wiring those to read live would be a natural next step but wasn't required by "adapt existing plan data to this architecture" and risked touching more of that already-large file than necessary.

### Feature entitlements

`lib/services/entitlementService.js` is the single source of truth for "does this restaurant have feature X?" — **do not** read `restaurant.feature_flags` inline anywhere; call `hasFeature(restaurant, FEATURES.X)` / `getEntitlements(restaurant)` (plain functions, usable in services and components alike) or the `useFeature(key)` / `useEntitlements()` hooks in `hooks/useEntitlement.js` (subscribe to the store's `restaurant` slice specifically, so they don't re-render on unrelated realtime churn).

Precedence, highest first: **(1)** explicit `restaurant.feature_flags[key]` (`true`/`false`) — a super admin's per-restaurant override always wins over plan; **(2)** `PLAN_FEATURE_DEFAULTS[restaurant.plan][key]`; **(3)** `FEATURE_REGISTRY[key].defaultEnabled` — used for unknown plans and while `restaurant` is still loading (`null`). An unregistered key always resolves `false` (fails closed). `PLAN_DEFAULT_FLAGS` is kept as an alias export of `PLAN_FEATURE_DEFAULTS` for the write paths (`superAdminService.js`) that already used that name; `components/superadmin/constants.js`'s `PLAN_DEFAULT_FLAGS`/`FEATURE_FLAG_META`/`featureFlags` are now thin re-exports of the service, not a second copy. Since `0021`, `PLAN_FEATURE_DEFAULTS` is also **hydratable** from the live `plan_features` table (`hydratePlanFeatureDefaults()`, called by `lib/store.js`'s `loadPlans()`) — see **Plan & subscription system** above; the hardcoded object above is now the fallback/initial value, not the permanent source of truth.

Current registry: `apple_pay`, `google_pay`, `banners` — all `defaultEnabled: true` (deliberately grandfathered so the resolver is a behavior-neutral swap for the old `!== false` reading; do not "fix" this to `false`, it would silently disable these features everywhere). All three are `enforcement: 'ui'` — cosmetic only, **no RLS/RPC backs any of them yet**. The registry's `enforcement` field exists so a future feature needing real enforcement doesn't require a consumer-API change, but adding that enforcement is separate work, not implied by the registry.

**The SuperAdmin toggles for these three flags are currently inert on the customer-facing menu.** `get_public_restaurant()` (the RPC unauthenticated customers read via, `0007`/replaced by `0020` — see Tenant resolution above) exposes neither `feature_flags` nor `plan` — only branding columns. So on the customer surface `restaurant.feature_flags` and `restaurant.plan` are always `undefined`, and the resolver correctly falls through to step 3 (`defaultEnabled: true`) regardless of what a super admin set. This is not a bug in the resolver — it reproduces the pre-resolver behavior exactly — but it does mean the toggles only currently affect what Admin/Staff/SuperAdmin see (e.g. the wallet buttons in `PaymentsManagement`, the banner editor gate in `DesignTab`), not the customer menu itself. Making the toggles govern the customer menu needs an explicit, separate migration exposing `feature_flags` in `get_public_restaurant()`'s column list (deliberately not `plan` — that stays billing-private per `0007`'s own rationale) — a product decision, not a bug fix.

### Banner CTA/action system

`banners.action_type` (`none`/`product`/`category`/`external`/`phone`, migration `0019_banner_actions.sql`) + `banners.action_target_id` (unconstrained `uuid`, no FK on purpose). `link_url` (from `0006`) is reused for `external`/`phone` rather than adding a duplicate column — there is no separate `action_url`.

- **Admin side**: `DesignTab.jsx`'s banner form now has full CRUD (create **and edit** — `updateBanner` existed in the store since the original banner work but was never wired into any UI until now), an active/inactive toggle (`Eye`/`EyeOff`, reuses `updateBanner`), and delete now goes through `ConfirmDialog` instead of deleting on the first click.
- **Customer side**: `CustomerApp.jsx` resolves `action_target_id` by looking it up in the restaurant's own already-loaded `PRODUCTS`/`CATEGORIES` arrays (both are `restaurant_id`-scoped by `loadMenuData()`) — this is *also* the tenant-safety and graceful-fallback mechanism: a banner pointing at another restaurant's id, or a deleted one, simply isn't found there, so it silently renders as a non-interactive image rather than needing an explicit check. Verified against live data (two real tenants, a cross-tenant target, and a dangling target) that this resolves exactly as intended.
- `product`/`category` render as a `<button onClick>` (opens `ProductDetailModal` / filters + scrolls to `#menu-categories`); `external`/`phone` still render as `<a href>` (`target="_blank"` only for `external`). A small `ArrowUpRight` badge is the only signal a customer gets that a banner is interactive — there was previously **none at all**, not even on hover, on touch devices.
- **`campaign` and generic `internal` action types were deliberately not built.** CustomerApp has no campaign detail view (campaigns are an admin-only grouping concept for discounts, never rendered to customers) and no multi-page routing for a generic internal destination beyond category selection, which is already covered. Adding either now would mean inventing a destination screen that doesn't exist yet.
- **Backwards compatibility**: any banner that already had a working `link_url` before this migration was backfilled to `action_type='external'` in the same migration — without that, every existing clickable banner would have silently stopped being clickable under the new column's `'none'` default.

## Role capabilities

`lib/services/capabilityService.js` is the single source of truth for "can THIS ROLE perform THIS ACTION?" (Master Plan Phase 6) — call `hasCapability(role, CAPABILITIES.X)` / `getCapabilities(role)` (plain functions) or the `useCapability(key)` / `useCapabilities()` hooks in `hooks/useCapability.js` (subscribe to the store's `profile?.role` slice specifically, same reasoning as the entitlement hooks).

This is a **different axis** from Feature entitlements above, not a second copy of it: entitlements resolve "does this restaurant's *plan* (with a per-restaurant override) allow feature X?" (tenant-scoped); capabilities resolve "can this *role* perform action X at all?" (role-scoped, static — no per-restaurant override, since job function isn't something a restaurant buys).

Registry: `products.view/create/edit/delete`, `orders.view/manage`, `payments.view/manage`, `banners.view/create/edit/delete`, `analytics.view`, `users.manage`, `restaurant.settings`. Precedence is a flat per-role grant list (no plan/override layers): `super_admin` is a generated wildcard (every key, `true` — see the file's own comment for why it's generated rather than hand-copied); `restaurant_admin` and `staff` are explicit objects, fail-closed (a key absent from a role's object, an unregistered key, or an unrecognized/missing role — including `unassigned` — all resolve `false`). The matrix reflects what each role can *already do* in the shipped UI, not a new restriction — see the file's own comments for the reasoning behind each `false`, most importantly `restaurant_admin`'s `users.manage: false` (per the locked D1 decision, account assignment is super-admin-only).

**SCOPE/SECURITY, same rule as the entitlement resolver**: every capability here is `enforcement: 'ui'` in spirit — it decides what renders, not what Postgres accepts. It is **not** a new authorization boundary; RLS + the `SECURITY DEFINER` RPCs are still the only real one (see Security invariants above). Hiding a button here stops a legitimate user's wrong click, not a motivated one calling Supabase directly.

Wired call sites (all additive gates — verified none currently hide anything, since the only role that reaches each surface today already holds every capability it checks, except `restaurant_admin`'s `users.manage`, which the surface never exposed an action for anyway):
- `AdminApp.jsx` — create/edit/delete buttons for products & categories (categories ride `products.*`, no capability of their own — no `categories.*` was requested), and tab-level `.view` gates for orders/payments/reports/settings.
- `DesignTab.jsx` — banner create/edit/delete/active-toggle buttons (`banners.*`), independent of the existing `useFeature(FEATURES.BANNERS)` plan gate on the same form.
- `StaffApp.jsx` + `components/staff/OrderCard.jsx` — order status-transition button and alert-resolve button, both gated on `orders.manage` (`OrderCard`'s new `readOnly` prop, default `false`).
- `components/superadmin/RestaurantsTab.jsx`'s `AdminsModal` — the assign-user form and remove-user button, gated on `users.manage`; this is the one surface where that capability's real implementation (`assignUserToRestaurant`/`removeUserFromRestaurant`) actually lives.

## Localization

Every surface (Customer, Admin, Staff, SuperAdmin, Auth, Onboarding, the public marketing site) is AZ/EN/RU. The active language persists per browser and, for signed-in users, syncs across devices.

- **`lib/i18n/languageStore.js`** — a separate, persisted Zustand store (`localStorage` key `menuflow-language`), deliberately *not* folded into `useAppStore` (documented above as "not persisted" for every other slice — mixing concerns here would contradict that). Holds `language` and `hasExplicitPreference` (did the user pick this in *this* browser, vs. was it hydrated from their account).
- **`hooks/useLanguage.js`** — thin `{ language, setLanguage }` hook over the store, mirrors the `useFeature`/`useCapability` hook shape.
- **`hooks/useLocaleSync.js`** — mounted once in `AdminApp`/`StaffApp`/`SuperAdminApp` next to their existing profile-load effects. `useLocaleSync(profile?.locale)` hydrates the store from the signed-in user's saved `profiles.locale` **only if** `hasExplicitPreference` is false — a fresh browser adopts the account's saved language; a browser that already has an explicit choice is never overridden. `setLanguageAndSync(lang, profile)` (called by the switcher) updates the store immediately and, when `profile` is present, best-effort persists to the DB via `authService.updateMyLocale()` (the `update_my_locale` RPC — see Security invariants above).
- **`components/ui/LanguageSwitcher.jsx`** — the AZ/EN/RU pill control, `context: 'dark' | 'customer'` like every other primitive. Pass `profile` (from `useAppStore`) on authenticated surfaces so a change syncs to the DB; omit it on Customer/Auth/Onboarding/marketing pages where nobody's signed in yet — it stays local-only there.
- **Dictionaries** — `lib/i18n/index.js` exports `createTranslationHook(dictionary)`, the factory every dictionary uses to produce its own `useXTranslation()` hook (mirrors the existing `useToast()`/`useFeature()` shape). One dictionary per surface, all the same flat `{az:{...}, en:{...}, ru:{...}}` shape:
  - `lib/translations.js` — pre-existing, **untouched**, Customer-only, still keyed to `data/menu.json` seed ids. `CustomerApp.jsx` now reads its `lang` from `useLanguage()` instead of local state, but every `getLocalizedText`/`getLocalizedProduct`/`getLocalizedCategoryName` call keeps its exact original signature — AZ output is byte-identical to before.
  - `lib/i18n/dictionaries/{common,admin,staff,superadmin,auth,pricing,marketing,onboarding}.js` — new. `common` holds cross-panel strings (Yadda saxla/Ləğv et/Sil, generic validation/toast copy). Every AZ value in the swept dictionaries (`admin`/`staff`/`superadmin`/`auth`) is the **exact pre-existing hardcoded string**, copied verbatim — zero AZ regression was the point, not a rewrite. `marketing`/`pricing`/`onboarding` are brand-new surfaces, so their AZ was authored fresh rather than preserved from anywhere. `onboarding` is kept separate from `auth` (which stays scoped to login/reset/the pending-activation screen) since the setup wizard is a materially bigger, distinct piece of copy — same one-dictionary-per-surface convention as `admin`/`staff`/`superadmin`.
- **Locale-aware formatting**: a few call sites hardcoded the `'az-AZ'` `Intl` tag for dates/numbers regardless of UI language (`AdminApp`'s weekday abbreviations, `superadmin/constants.js`'s `formatDate`/`formatMoney`/`formatRelativeTime`). Those now take an optional `t`/`localeTag` param (`LOCALE_TAGS = { az: 'az-AZ', en: 'en-US', ru: 'ru-RU' }`, exported from `admin.js` and `superadmin/constants.js`) — omitted, they still return the original AZ-formatted output, so any call site not yet swept keeps working.
- Display-label helpers that used to be static AZ-only objects in `components/superadmin/constants.js` (`PLAN_META`, `SUBSCRIPTION_STATUS_META`, `ROLE_LABELS`) now have a `(value, t)`-shaped sibling (`planMeta`, `subscriptionMeta`, `roleLabel`) — translates when `t` is passed, falls back to the original AZ literal otherwise. `FEATURE_REGISTRY`'s own AZ-only `label`/`description` (`lib/services/entitlementService.js` — a resolver shared by Customer/Admin/SuperAdmin, deliberately left untouched) are overridden for display in `RestaurantsTab.jsx`/`PlansTab.jsx`/`/pricing` via a local `FEATURE_LABEL_KEYS` map into the relevant dictionary, not by editing the registry.

## Conventions

- **All application code is `.jsx`/`.js`, not TypeScript.** `tsconfig.json` exists for Next's sake with `allowJs` and only includes `**/*.ts(x)`; the only TS file is `next.config.ts`. Do not convert JSX to TSX.
- Imports use the `@/` alias (maps to repo root).
- Tailwind v4 via `@tailwindcss/postcss`; there is no `tailwind.config.js`. `app/globals.css` is `@import "tailwindcss"` plus base styles, Google Fonts, and hand-written glassmorphism utility classes (`.glass-panel`, …). Styling is otherwise inline Tailwind with arbitrary values.
- Customer theming is done with a `--theme-primary` CSS variable set inline in `CustomerApp.jsx` from `restaurant.theme_primary_color`; components reference `text-[var(--theme-primary)]`.
- UI strings are localized AZ/EN/RU across every surface via the `lib/i18n/*` system — see **Localization** below. `lib/translations.js`'s `productTranslations`/`categoryTranslations` are still keyed to the static seed ids in `data/menu.json` (`p1`, `pizza`, …), so DB-backed products still never translate — that gap is unchanged; only the delivery mechanism (persisted, shared store vs. local `useState`) and its reach (every surface, not just Customer) changed.
- Comments in this codebase explain *why* (usually referencing the migration that forced the design). Follow that; don't strip them.
- `data/menu.json` / `data/menuData.js` are the seed fallback the store shows before/without Supabase data — not live data.

## Design system

A shared primitive kit exists at `components/ui/` alongside the original 4 state components (`LoadingState`, `ErrorState`, `EmptyState`, `PageSkeleton` — unchanged): `Button`, `Input`, `Select`, `Field`, `Badge`, `LanguageSwitcher` (see **Localization** above), and `ToastProvider`/`useToast` (promoted from `components/superadmin/Toast.jsx`, which is now a re-export shim — its one importer, `SuperAdminApp.jsx`, is unaffected). `LanguageSwitcher` was adopted everywhere from day one since it had no pre-existing equivalent to opt in over; the rest started as additive-only with two early pilots (`DesignTab.jsx`; the `statusBadgeClasses` helper in `AdminApp.jsx`) — **that "opt-in only" framing is now stale for `/admin` specifically**, see the adoption-status bullet below.

- **Token layer:** `components/ui/variants.js` — every `cva` recipe in one file, no JSX. Recipes read Tailwind classes that reference CSS variables (`var(--mf-*)`) rather than hardcoded hex/slate values, so the palette lives in one place. **No `@theme` block, no new JS token module** — adding one would be a second/third parallel system next to `.customer-theme`'s existing `--mf-*` namespace and `.superadmin-theme`'s `--sa-*` radius/type-scale tokens; deliberately not done. `class-variance-authority`/`clsx`/`tailwind-merge` were already installed and unused before this — no new dependency was added.
- **Two visual contexts, one component:** every primitive takes a `context: 'dark' | 'customer'` prop (`defaultVariants: { context: 'dark' }`, since ~90% of call sites are the management shell). `app/globals.css` now defines `.mf-dark` as the dark-shell counterpart to `.customer-theme`'s `--mf-*` namespace (same keys — `--mf-bg`, `--mf-surface`, `--mf-border`, `--mf-primary`, `--mf-text`, `--mf-text-muted`, plus `--mf-danger`/`--mf-focus`), added at the end of the file so the documented `@import`-ordering constraint is untouched. Customer-context recipes delegate to the existing `.customer-btn-primary` class (and `--theme-primary`) rather than re-specifying it, so the two can't drift apart.
- **`.mf-dark` is mounted on `<body>`** (`app/layout.jsx`), not left as a dangling unused class. It was defined in `app/globals.css` during the primitives-foundation pass but never actually applied anywhere — every `context="dark"` primitive (the DesignTab Button/Input pilot included) was silently resolving `var(--mf-*)` to nothing until this was caught and fixed. `.mf-dark` only declares custom properties (no `background-color`/`color` of its own), so mounting it body-wide is purely additive; `.customer-theme`'s own nested re-declarations of the same `--mf-*` names still correctly override it per normal CSS custom-property inheritance (nearest ancestor wins), so customer surfaces are unaffected.
- **Card, Modal, Alert, Tabs are now built** (Phase A of the global UI/UX redesign). `Card`/`CardHeader`/`CardBody`/`CardFooter` fill the gap that was deliberately left open before — they do **not** replace `.glass-panel` or `.sa-card`, which still govern the surfaces that already opted into a glass look; `Card` names the ~90 previously-unnamed flat `bg-slate-900 border-slate-800` literals instead. `Modal` replaced 6 hand-rolled `fixed inset-0 z-50` overlays (`AdminApp`'s `ProductModal`/`CategoryModal`/`ConfirmModal`, `ProductDetailModal`, `CartDrawer`, `CustomerApp`'s bill-payment modal) with one primitive that adds a real focus trap, Escape, scroll lock, and `role="dialog"` — none of the originals had any of that. `Alert` replaced 3 duplicated warning-banner instances (`AdminApp` trial-expiring notice + wallet-disabled notice, `DesignTab` banner-disabled notice). `Tabs`/`TabsTrigger` replaced `StaffApp`'s orders/alerts segmented toggle.
  - **Two SuperAdmin modals in `RestaurantsTab.jsx` were deliberately NOT migrated** — they're Framer-Motion-driven (`modalMotion.overlay`) and live entirely in the separate `.sa-*` token system; migrating them means either dropping their existing motion polish or teaching `Modal` a Framer Motion variant, which belongs to the SuperAdmin dashboard redesign, not primitive-authoring. Same for `Sidebar.jsx`'s mobile-nav backdrop (navigation chrome, not a content dialog).
  - **`Modal` does not portal customer-context dialogs.** `--theme-primary` (the per-restaurant accent every customer surface reads) is set via an *inline style* on `CustomerApp`'s own root div, not a CSS class — `createPortal`-ing to `document.body` would escape that inline style and break every `var(--theme-primary)` inside the dialog. Dark-context modals DO portal to `document.body`, safe only because `.mf-dark` is now mounted there too. If a customer-context dialog is ever ported to a different rendering point than a descendant of `CustomerApp`, re-verify `--theme-primary` is still reachable before assuming Modal "just works" there.
- **Accessibility baked into the base layer, not bolted on per-variant:** every interactive primitive's `focus-visible:ring-*` lives in each recipe's shared base class (so it can't be forgotten on a new variant), fixing a real gap — the codebase had 50 `focus:outline-none` sites and zero `focus-visible:` before this. `Field` (`useId()`-based) wires `label htmlFor` ↔ control `id` ↔ `aria-describedby` for hint/error, fixing another real gap (28 `<label>` elements with no `htmlFor`). `Button` defaults `type="button"` unless the caller passes `type="submit"` explicitly, so an icon/toolbar button can't accidentally submit its parent form. A `prefers-reduced-motion` block (end of `globals.css`) disables the repo's own CSS transitions/animations (`.sa-toast`, `.sa-card` hover-lift, etc.); it does **not** touch the 8 files using `motion/react` — those need `<MotionConfig reducedMotion="user">` at each app root, which is separate, not-yet-done work. `Modal`'s own entrance transition uses `motion-safe:`/`motion-reduce:` Tailwind variants directly rather than relying on that block.
- **Adoption is opt-in per surface, not a whole-repo migration project.** Convert a file's markup only when already editing it for another reason; convert the whole file/tab in one pass so nothing sits half-migrated. **`/admin` (`AdminApp.jsx` + its imported tab components) is now the one surface that's fully done** — every one of its 13 nav sections (Dashboard, Products, Categories, Tables, QR Codes, Orders, Payments, Reports, Promotions, Design, Audit Log, Users, Settings) runs on the primitive kit; zero raw `bg-slate-900(/60) border border-slate-800 rounded-2xl/3xl` card literals remain anywhere in `AdminApp.jsx`, `SettingsTab.jsx`, `PromotionsTab.jsx`, `AuditLogTab.jsx`, or `DesignTab.jsx` (verified by repo-wide grep). **`StaffApp.jsx` and the Customer/marketing surfaces are unaffected** — this pass was scoped to `/admin` only. **SuperAdmin's own `.sa-*` system is deliberately still untouched** (its 2 CRUD modals, its 2 tables, its `Sidebar.jsx` mobile backdrop) — same "different, already-polished system" reasoning as Phase A/B below, not an oversight.
  - **The established per-page pattern**: `PageHeader` (title + optional description + an `actions` slot) sits *outside* and *above* any `Card`, as the one heading for that tab — never nested inside a card's own header row. `CardHeader` is reserved for *sub-section* headings within a page that has more than one grouped block (e.g. `DashboardHome`'s chart panels, `DesignTab`'s Theme Builder vs. Banner System sections, `PaymentsManagement`'s per-schema tables). List/record data goes in `Card`+`Table` when it's genuinely tabular (Products, Tables, Orders, Payments, Audit Log); a plain `Card`-wrapped row list is used instead when a full `<table>` would be disproportionate to the content (Categories, Promotions' two sections) — this is a per-page judgment call, not a hard rule.
  - **Status/type indicators use `Badge`**, sourced from a shared tone-mapping helper (`statusBadgeTone(status)` in `AdminApp.jsx`, a sibling of the older `statusBadgeClasses(status)` that returns raw class strings for the handful of call sites — `DashboardHome`'s recent-orders table — not yet converted to `Badge`) rather than each call site re-deriving its own color logic.
  - **Icon-only action buttons (edit/delete/rename toggle) deliberately stay plain `<button>`, not the `Button` primitive** — `Button`'s size variants (`sm`/`md`/`lg`/`block`) have no compact square-icon treatment, so forcing them in would either bloat the hit target or need a new variant nobody asked for. `Button` is reserved for real labeled actions (submit, cancel, page-level "+ New X", "Print"). This is why the QR Codes tab's individual printable tiles — deliberately kept white/light and outside the dark `Card` styling, since they're a print/scan artifact, not admin chrome — also keep their rename/download buttons as plain `<button>`, matching the dark-shell icon-button convention rather than fighting `Button`'s dark-context defaults on a light card.
  - **Empty-state choice depends on scope**: the full `EmptyState` block (icon+title+description) replaces the whole page's content when *the entire tab* has nothing to show (Products, Categories, Tables, Orders, Promotions' two sections, Audit Log, Design's banner list). `TableEmptyRow` (inside an otherwise-populated table shell) is kept for sub-sections where the page itself isn't empty, just one panel within it (`DashboardHome`'s recent-orders table, `PaymentSchemaTable`'s three per-method tables).
  - Several pages gained a `Badge`/description that didn't exist before, always as a **pure display addition surfacing an already-computed or already-stored value** — never new state, writes, or capability gates: Categories' per-category product-count badge, the QR tab's "missing token" badge (`!qrTokensByTableId[table.id]`), Promotions' campaign Active/Inactive badge (from `campaigns.is_active`, previously fetched but never rendered).
- **`components/ui/Navigation.jsx` (`PageHeader`, `Breadcrumbs`) completes the primitive-kit checklist.** `Sidebar` (vertical nav) and `Tabs` (in-page segmented nav) already existed; this was the missing horizontal piece — every dashboard used to hand-roll its own heading (`AdminApp`'s per-tab `<h2 className="text-2xl font-serif-title font-bold text-white mb-6">`, `SuperAdminApp`'s own `sa-heading-4`). It's the Phase B "consistent page headers" gap below — **now adopted on every `/admin` tab** (see above); `SuperAdminApp`/`StaffApp` still hand-roll their own headings, unmigrated. Alongside it, three existing primitives got small **additive, backward-compatible** completions to close the remaining form-states gap (no primitive previously had a success state or a loading state): `Button` gained `loading` (spinner + forced `disabled` + `aria-busy`), `Input`/`Select` gained `valid` (success counterpart to the existing `invalid`), `Field` gained a `success` message slot (parallel to `hint`/`error`). All four are additive optional props defaulting to prior behavior.

## Known mismatches worth verifying before touching related code

These are real inconsistencies in the current repo, not things to "clean up" unprompted:

- **Product field mapping is in the service layer, not the DB (`0017`).** `products` stores `category_id`, `is_popular`, `is_chef_choice`, `is_spicy`, `is_vegetarian`, `prep_time_minutes` (snake_case). The frontend uses `category`, `isPopular`, `isChefChoice`, `isSpicy`, `isVegetarian`, `prepTime`/`prepTimeMinutes` (camelCase). `lib/services/supabaseService.js` translates both ways: `normalizeProduct` (DB→UI, and it formats `prep_time_minutes` into the display string `prepTime` = `"15 dəq"`) and `toProductRow` (UI→DB, whitelist — it drops unknown keys like `currency`/`calories`/`ingredients` so a stray form field can't 400 the write again). `category_id` stays the single source of truth; there is no `products.category` column. When adding a product field, extend **both** functions plus a migration — don't spread the form object straight into an insert.
- `calories` and `ingredients` are **seed-JSON-only** (`data/menu.json`), rendered by `ProductDetailModal` when present but with no DB column and no admin input — deferred, not broken. Don't add columns for them without a real requirement.
- `products.options` is a jsonb array (`[{title, choices:[{name, extraPrice}]}]`). It is the current add-on/variant store and `place_order()` prices against it server-side. A future normalized add-on system must still snapshot the selected option + its price onto each order line (today `order_items` has no `selected_options` column — the chosen names are not persisted per line, only their summed price is). Preserve historical pricing when that work happens.
- Product images are URL-only (`products.image` text). There is no file input and **no Supabase Storage usage anywhere** in the repo. A future upload feature needs: a Storage bucket, per-restaurant path isolation + RLS on `storage.objects`, file type/size validation, and tenant-ownership checks — none of which exist yet.
- `@google/genai`, `html2canvas`, and `@hookform/resolvers` are dependencies with zero imports. `.env.example` still describes a `GEMINI_API_KEY` from the project's AI Studio origin. (`class-variance-authority` is no longer in this list — it now backs `components/ui/variants.js`.)
- The README's top section is leftover AI Studio boilerplate; its lower Azerbaijani sections are accurate.
- `PROJECT_MAP.md` is aspirational/generic: it repeatedly links a `docs/` directory of files that don't exist (`docs/SECURITY.md`, `docs/AUTH.md`, `docs/QR_SYSTEM.md`, `docs/ORDER_SYSTEM.md`, `docs/REALTIME.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`) — the only file actually in `docs/` is `PROJECT_CONTEXT.md` (the persistent-state file the top of this document points to). Treat `PROJECT_MAP.md`'s policy rules (tenant isolation, never disable RLS, minimal targeted changes, don't claim verification you didn't run) as worth following; its factual/file-existence claims are not. `AGENTS.md` is just the same auto-generated `nextjs-agent-rules` block that's appended to the bottom of this file — not independent content. `SECURITY_MIGRATION_NOTES.md` is short and stale (lists only 5 of the 25 migration files) but not wrong about what it does list.

## Not implemented

No POS integration layer, no super-admin website/content management, no payment processor, no add-on/product-option management outside the `products.options` jsonb editor in the admin product form, no automated subscription renewal (billing_interval/auto_renew are tracked fields, not an active billing engine). The public marketing site covers `/`, `/features`, `/faq`, `/demo`, `/contact`, `/pricing` — no legal pages (privacy/terms) beyond those, and no lead-capture backend behind `/contact` (real `wa.me`/`mailto` links only, no form — see Architecture above). If a task assumes anything else exists, verify first — it doesn't.

## MASTER PLAN STATUS

Tracks the SaaS build-out. Update a row **only** when that phase is genuinely implemented and verified. `✅` done · `🔄` in progress · `⬜` not started.

| Phase | Area | Status |
|---|---|---|
| 1 | Core schema reconciliation (`orders.note`, product badge/prep fields, `category`↔`category_id`, currency source) | ✅ (migration `0017`) |
| 2 | Public marketing website (`/`, features, pricing, faq, demo, contact) | ✅ all six pages built (`/pricing` adapted to match, `/` converted from the legacy role-switcher) — shared `components/marketing/{MarketingHeader,MarketingFooter,PhoneShowcase}.jsx`, AZ/EN/RU via `lib/i18n/dictionaries/marketing.js`. No lead-capture backend behind `/contact` (real `wa.me`/`mailto` links only) |
| 3 | Authentication (register/login/forgot/reset) | 🔄 account model locked (see below) |
| 4 | Restaurant registration & onboarding | 🔄 self-service registration still disabled (D1 locked); the post-activation setup wizard (`OnboardingWizard.jsx`, migration `0024`) is built and gates `/admin` server-side via `middleware.js` — see Roles above. Not done: this phase's "registration" half (there is still no self-serve tenant creation, by design) |
| 5 | Multi-tenant architecture (formal ownership + `restaurant_id` audit) | ⬜ (core in place since `0001`; full RLS/tenant-isolation audit run `2026-08-11` — see Security invariants above — but this phase also implies a formal ownership-model review beyond RLS, still pending) |
| 6 | Roles & permissions (capability layer) | 🔄 capability resolver landed (`lib/services/capabilityService.js`, wired into `AdminApp`/`DesignTab`/`StaffApp`+`OrderCard`/`RestaurantsTab`'s `AdminsModal` — see Role capabilities above) — still UI-only, no RLS/RPC enforcement yet (roles + RLS still do the actual data-access enforcement, same as before) |
| 7 | Super Admin (separation hardening) | ⬜ (panel exists; explicit-access hardening pending) |
| 8 | Feature entitlement resolver + enforcement | 🔄 resolver landed (`lib/services/entitlementService.js`, all 6 inline call sites migrated), now DB-hydratable from `plan_features` (`0021`) — still UI-only, no RLS/RPC enforcement yet, and inert on the customer surface until `restaurants_public`'s successor (`get_public_restaurant()`, `0020`) exposes `feature_flags` (see Feature entitlements above) |
| 9 | Subscriptions (plan-definition data, billing cycle, lifecycle) | 🔄 `plans`/`plan_features`/`restaurant_subscriptions`/`restaurant_feature_overrides` landed (`0021`), SuperAdmin CRUD UI (`PlansTab.jsx`, `RestaurantSubscriptionPanel`) — see **Plan & subscription system** above. Billing is still fully manual (no gateway); `billing_interval`/`auto_renew` are tracked but nothing automates a renewal |
| 10 | Payments (per-restaurant destination, payment_status, platform-vs-restaurant split) | ⬜ (wallet token only, never charged) |
| 11 | Order hardening (idempotency, payment state machine) | ⬜ (server-side pricing done in `0013`) |
| 12 | Analytics (extended, tenant-scoped) | ⬜ (basic admin + platform dashboards exist) |
| 13 | Production hardening + deployment | ⬜ (Vercel deploy: needs `NEXT_PUBLIC_SUPABASE_*` in project env; MCP file-upload impractical at this size — use git/CLI) |
| 14 | POS integration adapter layer | ⬜ |

**D1 decision (locked): account creation is super-admin-only ("Yol A").** Public sign-up creates a login only; a super admin creates the restaurant and assigns the admin by email. Self-service tenant creation is revoked in `0018`. See the Roles section. Changing this model is a stop-and-ask architectural decision.

### Global UI/UX redesign — separate 6-phase tracker (A–F)

A cross-cutting design initiative layered on top of the numbered phases above, not a replacement for them. Uses `A`/`B`/`C`… to avoid colliding with the `1`–`14` numbering.

| Phase | Scope | Status |
|---|---|---|
| A | Design-token foundation + core primitives (`Card`, `Modal`, `Alert`, `Tabs`, plus the pre-existing `Button`/`Input`/`Select`/`Field`/`Badge`/`Toast`) | ✅ built + piloted (6 Modal instances, 3 Alert instances, 1 Tabs instance migrated; see Design system above) |
| B | Shared dashboard shell/navigation across SuperAdmin, Admin, Staff | 🔄 `components/ui/Sidebar.jsx` (+ `SidebarMenuButton`) built, generalizing the mobile scrim/off-canvas/hamburger pattern already proven in `components/superadmin/Sidebar.jsx` (left as-is — its own `.sa-*` visual language, not migrated). Fixed a real bug: `AdminApp.jsx`'s sidebar was `hidden md:flex` with **no mobile fallback at all** — below 768px a restaurant_admin could never switch tabs. `components/ui/ConfirmDialog.jsx` (+ `useConfirmDialog`) promoted from AdminApp's local `ConfirmModal`/`confirmState` pair; used to fix two more real gaps in `components/superadmin/RestaurantsTab.jsx` — `deleteRestaurant` (irreversible, cascades every product/order/table) used the raw native `window.confirm()`, and `removeUserFromRestaurant` had **no confirmation at all**, a one-tap action. `StaffApp.jsx` has no sidebar (single-page + `Tabs`, already responsive) — nothing to migrate there. `components/ui/Table.jsx` (+ `TableHead`/`TableHeaderCell`/`TableBody`/`TableRow`/`TableCell`/`TableEmptyRow`) consolidates what were 3 identical raw `<table className="w-full text-sm">` blocks in `AdminApp.jsx`, now used across every tabular `/admin` tab. **Deliberately NOT migrated**: SuperAdmin's own 2 tables (`RestaurantsTab.jsx`, `UsersTab.jsx`) use `.sa-caption` typography + per-row `motion.tr` stagger animation, a different already-polished system — same category of decision as its 2 CRUD modals and its own `Sidebar.jsx` mobile backdrop (all 3 preserved, not flattened). `components/ui/Navigation.jsx` (`PageHeader`/`Breadcrumbs`) is now adopted on **every `/admin` tab** (see Design system above for the exact pattern) — that was the remaining Phase B scope for Admin specifically. Still open: `SuperAdminApp`'s own `sa-heading-4` headings and `StaffApp`'s heading are unmigrated. |
| C | Product/catalog workflows, localized product editing, banner CTA/action behavior | 🔄 Banner CTA/action system done (migration `0019_banner_actions.sql`) — see "Banner CTA/action system" below. Product/catalog workflow polish and localized product editing not started. |
| D | Customer QR Menu visual/UX pass | ⬜ (structural primitives adopted in Phase A — `ProductDetailModal`/`CartDrawer` now use `Modal` — but no visual redesign done) |
| E | Public marketing website (`/`, `/features`, `/pricing`, `/faq`, `/demo`, `/contact`) | ✅ same work as Phase 2 above — every page built with existing primitives (`Card`/`Badge`/`Tabs`/`Button`) and the existing dark `.mf-dark` token system, no new visual language introduced |
| F | AZ/EN/RU localization QA, responsive QA, accessibility QA, visual-consistency pass | 🔄 localization itself is now built app-wide (see **Localization** above) — more than this phase originally scoped (QA of an existing system), since the system didn't exist before. Verified: lint/build clean, live language-switch + persistence browser-tested on Customer/pricing/login/marketing pages, mobile/tablet/desktop responsive-checked on the marketing site (one real bug found and fixed — header nav overflow at the `md` breakpoint, moved to `lg`). Not done: a dedicated accessibility pass (contrast/keyboard/screen-reader) and responsive QA of the pre-existing Admin/Staff/SuperAdmin dashboards (only the new marketing pages were resize-tested) |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
