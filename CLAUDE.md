# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # node_modules is NOT checked in
npm run dev          # next dev — Turbopack, port 3000
npm run build        # next build
npm run lint         # eslint .
node scripts/verify-order-subscription.mjs   # the only executable check in the repo
```

- There is **no test framework** (no jest/vitest/playwright). `scripts/verify-order-subscription.mjs` is a standalone assertion script that exits non-zero on failure; it is the closest thing to a test. New logic-level checks should follow that pattern (plain `.mjs`, `process.exit(1)` on failure) unless the user asks for a real test runner.
- `next.config.ts` sets `output: 'standalone'`, so **`npm start` fails** — run `node .next/standalone/server.js` instead (see `server.log` for the exact error this produced before).
- Both `bun.lock` and `package-lock.json` exist; `npm install` is what has actually been run. Installed version is **Next 16.3.0**.
- ESLint config is duplicated in `eslint.config.mjs` (flat, used by ESLint 9) and legacy `.eslintrc.json`.

### Next 16 specifics

This project was written for Next 15 and upgraded; several Next 16 behaviors bite here:

- **Turbopack is the default bundler.** `next.config.ts` carries an empty `turbopack: {}` purely because Next 16 hard-errors (prints "Ready", then exits) when it finds a `webpack` config with no `turbopack` config beside it. The `webpack` block is only the AI Studio `DISABLE_HMR` file-watching workaround; use `next dev --webpack` if that path is ever needed.
- **Turbopack's CSS parser is strict about `@import` ordering.** In `app/globals.css` the Google Fonts `@import` must stay *above* `@import "tailwindcss"` — Tailwind gets inlined in place, and any `@import` after it no longer "precedes all rules", which fails the whole stylesheet and 500s every route.
- The `eslint: { ignoreDuringBuilds: true }` key was **removed** from `next.config.ts` during the Next 16 upgrade: Next 16 dropped it from the `NextConfig` type, and `typescript.ignoreBuildErrors: false` turned that into a build-failing `TS2353`. It was already a runtime no-op — `next build` no longer runs ESLint at all, so lint is strictly a separate step (`npm run lint`) and **nothing gates it**.
- `middleware.js` triggers a deprecation warning (Next wants `proxy`). It still works — don't migrate it casually, since it is the server-side role gate.
- `next dev` **appends a `nextjs-agent-rules` block to this file on every run** (`node_modules/next/dist/server/lib/generate-agent-files.js`). It regenerates if deleted; leave it in place and commit it with your changes.

Running the app without `.env.local` is fine — `lib/supabase.js` falls back to a no-op client and the customer menu renders the `data/menu.json` seed data. Expect `Supabase client not ready` realtime warnings in that mode; they are handled, not bugs.

### Local Supabase project

`.env.local` points at a real Supabase project (`MenuFlow`, `eu-central-1`, free tier — org `cosqunfarzaliyev-dotcom's Org`) with all 17 migrations (`0000`–`0016`) applied via the Supabase MCP server, in order. It has the schema but **no seed data** — every table is empty, so the customer menu still shows `data/menu.json` (the store's empty-array fallback), which is expected, not a bug.

- Applying a migration through the MCP/SQL-editor path bypasses PostgREST's schema cache. If the app throws `PGRST205: Could not find the table 'public.x' in the schema cache` right after a migration, run `NOTIFY pgrst, 'reload schema';` (`execute_sql`) rather than assuming the migration failed.
- No super_admin exists yet. To get one: sign up through `/login` (Qeydiyyat) with a real email, then either promote that profile with `update public.profiles set role = 'super_admin' where email = '...'`, or go through `/onboarding` to self-serve a restaurant as `restaurant_admin` instead.
- `supabase/all_migrations_combined.sql` was **not** what was run — the individual `0000`–`0016` files were applied directly. Keep using the individual files as the source of truth for this project too.

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
- **`SECURITY DEFINER` RPCs** are the write layer for anything that can't be trusted to the client (`place_order`, `upsert_alert`, `create_restaurant_self_service`, `get_restaurant_qr_tokens`, `get_platform_users`, `verify_qr_token`).
- **`BEFORE INSERT` triggers** are the rate limiter and the privileged-field guard.

Consequence: *any* new security rule must land in a migration. Client-side checks in this repo are UX, not security.

### Four surfaces, four root components

| Route | Component | Audience |
|---|---|---|
| `/menu/[restaurant]/[table]?t=<qr-token>` | `components/CustomerApp.jsx` | unauthenticated customer |
| `/staff` | `components/StaffApp.jsx` | `staff`, `restaurant_admin` |
| `/admin` | `components/AdminApp.jsx` (2000+ lines, all tabs inline) | `restaurant_admin` |
| `/superadmin` | `components/SuperAdminApp.jsx` + `components/superadmin/*` | `super_admin` |

`app/*/page.jsx` files are thin `"use client"` wrappers. `app/page.jsx` is a legacy role-switcher that renders Admin/Staff/Customer from a `?role=` query param — it is **not** covered by middleware, so it relies entirely on RLS plus the components' own guards. `/stuff` redirects to `/staff`.

### Roles

Canonical role strings (from `profiles.role`, `lib/services/authService.js` `ROLES`):
`super_admin` | `restaurant_admin` | `staff` | `unassigned`

Note this is **`restaurant_admin`, not `admin`** — some of the older markdown docs in the repo get this wrong.

`middleware.js` runs on `/admin`, `/staff`, `/superadmin`, `/onboarding`. It calls `supabase.auth.getUser()` (revalidates the token server-side, unlike `getSession()`), reads `profiles.role`, and redirects to the role's home. This works only because `lib/supabase.js` uses `@supabase/ssr`'s `createBrowserClient`, which stores the session in **cookies** — do not swap it for a localStorage-backed client.

New signups get `role: 'unassigned'` via the `on_auth_user_created` trigger. **Account model is super-admin-only (Master Plan D1, "Yol A", migration `0018`):** signing up creates a *login* only — it never creates a restaurant. An `unassigned` user becomes a `restaurant_admin` **only** when a super admin creates a restaurant and assigns them by email in the SuperAdmin panel (`superAdminService.assignUserToRestaurant`). Self-service onboarding is disabled: `0018` revokes `execute` on `create_restaurant_self_service` from `authenticated`/`anon` (the function body is kept, not dropped), `app/onboarding/page.jsx` shows a "pending activation" screen instead of a creation form, and `billingService.createRestaurantSelfService` is deprecated with no live caller. Do not re-enable self-serve tenant creation without an explicit decision to change this model.

### Tenant resolution — two different paths

Every query is scoped by `restaurant_id`, and there are exactly two ways the current restaurant is resolved:

1. **Customer**: URL slug → `fetchRestaurantBySlug()` → reads the **`restaurants_public` view** (branding columns only). Never query the base `restaurants` table from an unauthenticated context — it is RLS-locked and carries billing fields.
2. **Admin/Staff/SuperAdmin**: session → `profiles.restaurant_id` → `fetchRestaurantById()` → full `restaurants` row.

### `lib/store.js` is the single data-access funnel

One Zustand store (not persisted). Every mutating action follows the same shape: read `restaurant.id` from the store, call the matching function in `lib/services/*`, then **re-fetch the whole collection** rather than patching local state, then optionally `recordAudit(...)`. Match this pattern when adding actions — components never call `lib/services/*` mutations directly.

`lib/store.js` also holds `qrToken` (from `?t=`), which `createOrder`/`createAlert` pass through to the RPCs.

Service split:
- `supabaseService.js` — products, categories, tables, orders, alerts (+ row normalizers that convert snake_case rows into the camelCase shapes components expect)
- `authService.js` — profile + restaurant resolution, `ROLES`
- `superAdminService.js` — tenants, plans, feature flags, user assignment
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
- **Rate limits** on order/alert INSERT, per-table and per-restaurant (`0002`, `0015`).
- **`restaurants_public` view** (`0007`) is the only anon-readable projection of `restaurants`.

Avoid `using (true)` / `with check (true)` on anything tenant-scoped. Note that `products`, `categories`, `restaurant_tables`, `banners`, `campaigns`, `discounts` intentionally have public SELECT — the customer menu is unauthenticated.

## Database & migrations

- Migrations live in `supabase/migrations/NNNN_name.sql` and are **applied by hand in the Supabase SQL editor** — there is no Supabase CLI setup, no `supabase/config.toml`, no local DB. Never assume a migration has been run; when a change needs one, say so explicitly.
- Every migration is written to be re-runnable (`if not exists`, `create or replace`, `drop policy if exists`).
- Add new work as the next `NNNN_` file. Do not edit historical migrations.
- `supabase/all_migrations_combined.sql` is a convenience bundle that **stops at 0013** — it does not include 0014/0015/0016. Treat the individual files as authoritative and update the bundle only if the user asks.
- Migration comments are unusually detailed (attack description, impact, fix, ordering). Keep that style.

Core tables: `restaurants`, `profiles`, `categories`, `products`, `restaurant_tables`, `orders`, `order_items`, `alerts`, `banners`, `campaigns`, `discounts`, `audit_logs`, `app_secrets`.
RLS helpers: `is_super_admin()`, `is_staff_of(restaurant_id)`, `current_role_name()`, `current_restaurant_id()`.

## Subscriptions & feature flags

Billing is **fully manual** — no gateway, no webhooks, no recurring charges. Super admin sets `plan` / `subscription_status` / `trial_ends_at` from the Restaurants tab; the helpers in `superAdminService.js` (`markRestaurantActive`, `extendRestaurantTrial`, …) are just wrappers over `updateRestaurant`.

Plans: `basic` | `pro` (`PLAN_ORDER` in `components/superadmin/constants.js`). `free`/`trial`/`enterprise` are legacy labels kept only so old rows render.

`isAccessBlocked(restaurant)` in `billingService.js` is the single gate every panel checks; it returns true for `is_active === false`, an expired trial, or `past_due`/`canceled`, and Admin/Staff render a lock screen instead of the panel.

Feature flags are a `restaurants.feature_flags` jsonb (`apple_pay`, `google_pay`, `banners`). Changing plan resets them to `PLAN_DEFAULT_FLAGS[plan]`; super admin can then override per restaurant. **Consumption today is UI-only** — components read `restaurant?.feature_flags?.x !== false` directly (`CustomerApp`, `AdminApp`, `DesignTab`). There is no central resolver and no backend enforcement; adding either is a change, not a bug fix.

## Conventions

- **All application code is `.jsx`/`.js`, not TypeScript.** `tsconfig.json` exists for Next's sake with `allowJs` and only includes `**/*.ts(x)`; the only TS file is `next.config.ts`. Do not convert JSX to TSX.
- Imports use the `@/` alias (maps to repo root).
- Tailwind v4 via `@tailwindcss/postcss`; there is no `tailwind.config.js`. `app/globals.css` is `@import "tailwindcss"` plus base styles, Google Fonts, and hand-written glassmorphism utility classes (`.glass-panel`, …). Styling is otherwise inline Tailwind with arbitrary values.
- Customer theming is done with a `--theme-primary` CSS variable set inline in `CustomerApp.jsx` from `restaurant.theme_primary_color`; components reference `text-[var(--theme-primary)]`.
- UI strings are **hardcoded Azerbaijani** throughout Admin/Staff/SuperAdmin. `lib/translations.js` (AZ/EN/RU) is wired only into `CustomerApp`, and its `productTranslations`/`categoryTranslations` are keyed to the static seed ids in `data/menu.json` (`p1`, `pizza`, …), so DB-backed products never translate. Language is component-local state with no persistence.
- Comments in this codebase explain *why* (usually referencing the migration that forced the design). Follow that; don't strip them.
- `data/menu.json` / `data/menuData.js` are the seed fallback the store shows before/without Supabase data — not live data.

## Known mismatches worth verifying before touching related code

These are real inconsistencies in the current repo, not things to "clean up" unprompted:

- **Product field mapping is in the service layer, not the DB (`0017`).** `products` stores `category_id`, `is_popular`, `is_chef_choice`, `is_spicy`, `is_vegetarian`, `prep_time_minutes` (snake_case). The frontend uses `category`, `isPopular`, `isChefChoice`, `isSpicy`, `isVegetarian`, `prepTime`/`prepTimeMinutes` (camelCase). `lib/services/supabaseService.js` translates both ways: `normalizeProduct` (DB→UI, and it formats `prep_time_minutes` into the display string `prepTime` = `"15 dəq"`) and `toProductRow` (UI→DB, whitelist — it drops unknown keys like `currency`/`calories`/`ingredients` so a stray form field can't 400 the write again). `category_id` stays the single source of truth; there is no `products.category` column. When adding a product field, extend **both** functions plus a migration — don't spread the form object straight into an insert.
- `calories` and `ingredients` are **seed-JSON-only** (`data/menu.json`), rendered by `ProductDetailModal` when present but with no DB column and no admin input — deferred, not broken. Don't add columns for them without a real requirement.
- `products.options` is a jsonb array (`[{title, choices:[{name, extraPrice}]}]`). It is the current add-on/variant store and `place_order()` prices against it server-side. A future normalized add-on system must still snapshot the selected option + its price onto each order line (today `order_items` has no `selected_options` column — the chosen names are not persisted per line, only their summed price is). Preserve historical pricing when that work happens.
- Product images are URL-only (`products.image` text). There is no file input and **no Supabase Storage usage anywhere** in the repo. A future upload feature needs: a Storage bucket, per-restaurant path isolation + RLS on `storage.objects`, file type/size validation, and tenant-ownership checks — none of which exist yet.
- `@google/genai`, `html2canvas`, `@hookform/resolvers`, and `class-variance-authority` are dependencies with zero imports. `.env.example` still describes a `GEMINI_API_KEY` from the project's AI Studio origin.
- The README's top section is leftover AI Studio boilerplate; its lower Azerbaijani sections are accurate.
- `CLAUDE(2).md`, `ARCHITECTURE.md`, `PROJECT_MAP.md`, and `DATABASE.md` are aspirational/generic: they reference a `docs/` directory that does not exist, name files (`SECURITY.md`, `AUTH.md`, `QR_SYSTEM.md`, `ORDER_SYSTEM.md`, `REALTIME.md`, `CHANGELOG.md`) that do not exist, call the project TypeScript, and use `admin` for the `restaurant_admin` role. Their policy rules (tenant isolation, never disable RLS, minimal targeted changes, don't claim verification you didn't run) are worth following; their factual claims are not.

## Not implemented

No POS integration layer, no public marketing website, no super-admin website/content management, no payment processor, no add-on/product-option management outside the `products.options` jsonb editor in the admin product form, no per-user language preference. If a task assumes any of these exist, verify first — they do not.

## MASTER PLAN STATUS

Tracks the SaaS build-out. Update a row **only** when that phase is genuinely implemented and verified. `✅` done · `🔄` in progress · `⬜` not started.

| Phase | Area | Status |
|---|---|---|
| 1 | Core schema reconciliation (`orders.note`, product badge/prep fields, `category`↔`category_id`, currency source) | ✅ (migration `0017`) |
| 2 | Public marketing website (`/`, features, pricing, faq, demo, contact) | ⬜ |
| 3 | Authentication (register/login/forgot/reset) | 🔄 account model locked (see below) |
| 4 | Restaurant registration & onboarding | 🔄 self-service disabled; super-admin-assign path exists |
| 5 | Multi-tenant architecture (formal ownership + `restaurant_id` audit) | ⬜ (core in place since `0001`; formal audit pending) |
| 6 | Roles & permissions (capability layer) | ⬜ (roles + RLS enforce data access; no permission matrix) |
| 7 | Super Admin (separation hardening) | ⬜ (panel exists; explicit-access hardening pending) |
| 8 | Feature entitlement resolver + enforcement | ⬜ (flags exist, UI-only — no central resolver) |
| 9 | Subscriptions (plan-definition data, billing cycle, lifecycle) | ⬜ (manual states only; plans hardcoded) |
| 10 | Payments (per-restaurant destination, payment_status, platform-vs-restaurant split) | ⬜ (wallet token only, never charged) |
| 11 | Order hardening (idempotency, payment state machine) | ⬜ (server-side pricing done in `0013`) |
| 12 | Analytics (extended, tenant-scoped) | ⬜ (basic admin + platform dashboards exist) |
| 13 | Production hardening + deployment | ⬜ (Vercel deploy: needs `NEXT_PUBLIC_SUPABASE_*` in project env; MCP file-upload impractical at this size — use git/CLI) |
| 14 | POS integration adapter layer | ⬜ |

**D1 decision (locked): account creation is super-admin-only ("Yol A").** Public sign-up creates a login only; a super admin creates the restaurant and assigns the admin by email. Self-service tenant creation is revoked in `0018`. See the Roles section. Changing this model is a stop-and-ask architectural decision.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
