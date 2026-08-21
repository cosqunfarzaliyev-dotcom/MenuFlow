# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # dev server, Turbopack
npm run build    # production build — deliberately --webpack, NOT Turbopack (see below)
npm run start    # serve the production build
npm run lint     # eslint . — baseline is 19 pre-existing problems (15 react-hooks/set-state-in-effect,
                 #   3 react-hooks/exhaustive-deps, 1 react-hooks/purity). Don't add new ones; fixing an
                 #   existing one is its own reviewed task since most touch auth/session-loading code.
```

There is no test framework. `scripts/verify-*.mjs` are standalone Node assertion scripts, the closest thing to tests — run one directly: `node scripts/verify-capabilities.mjs` (also `verify-entitlements.mjs`, `verify-plans.mjs`, `verify-order-subscription.mjs`, `verify-pos-integration.mjs`, `verify-translations.mjs`, `verify-site-content.mjs`, `verify-design-systems.mjs`, `verify-i18n-keys.mjs`). Each prints a numbered pass/fail list for one subsystem's invariants. **All nine exit 0** — treat any non-zero exit as new breakage, not as pre-existing noise.

**Database and Edge Functions are managed through the Supabase MCP server, not the Supabase CLI or dashboard SQL editor.** A new migration is a new numbered file in `supabase/migrations/` (`NNNN_description.sql`, next number after the highest existing one — check first, there are two files sharing prefix `0017`), applied live via the MCP `apply_migration` tool, then verified with `get_advisors` (security + performance). The repo file is the reviewable source of truth; the MCP call is the deploy mechanism — this mirrors how Edge Functions are deployed (`deploy_edge_function`, passing the function's file contents directly). After any schema change, run `get_advisors` before considering the work done — RLS-missing-policy and other findings are expected to be caught here, not discovered later.

## Architecture

**Stack**: Next.js 16 (App Router), React 19, plain `.jsx`/`.js` — no TypeScript except `next.config.ts` (kept only for Next's own config typing) and the Edge Functions (Deno, `.ts`). Supabase (Postgres + Auth + Realtime) via `@supabase/ssr`'s `createBrowserClient` — session lives in cookies, not localStorage, which is what lets `middleware.js` read and verify it server-side before a protected page ever renders. Tailwind v4 (no `tailwind.config.js`, config lives in `app/globals.css`), `class-variance-authority` backing both design systems' `variants.js`. State: one non-persisted Zustand store, `lib/store.js`.

### There is (almost) no backend

Nearly everything runs client-side against Supabase directly with the anon/publishable key. **RLS + `SECURITY DEFINER` RPCs + triggers are the entire server-side authorization layer** — there is no Express/Next API route doing auth checks anywhere. The recurring pattern for anything that needs privileged logic (server-computed pricing, a signed-QR-token check, an insert that must bypass RLS for a legitimate reason) is a `SECURITY DEFINER` Postgres function that **re-derives the caller's identity itself** (`auth.uid()`, or a token it validates) and never trusts an id/role passed as a parameter. Study `place_order()`, `settle_table_payment()`, `upsert_alert()`, or `is_staff_of()`/`is_admin_of()` in the migrations for the exact shape before adding a new one.

The few cases that genuinely can't be done from the browser (need the service-role key) are three Edge Functions under `supabase/functions/`, each a deliberate, narrow exception:
- `create-restaurant-user` — creating an `auth.users` row (super-admin-only account provisioning; there is no public sign-up anywhere in the app).
- `pos-poster-menu-sync` / `pos-poster-order-push` (+ shared `_shared/poster.ts` adapter) — POS integration; the Poster API token lives in a table with zero RLS policies and zero PostgREST grants, so only a service-role client can ever read it.
- `notify-push` — Web Push fan-out for staff order/alert notifications (`push_subscriptions` table, `0030_push_notifications.sql`); needs the service-role key to read every subscription for a restaurant and to write back `failure_count`/`last_success_at`, and signs each push with a VAPID key pair the client never has.

Every Edge Function follows the same two-client shape: `callerClient` (built from the incoming `Authorization` header) is used *only* to answer "who is this?" via `auth.getUser()`; `adminClient` (service role) is used only after that identity has been re-checked against `profiles.role` server-side. `verify_jwt: true` at deploy time is defense-in-depth, not the real check — except `pos-poster-order-push` and `notify-push`, both invoked by a Postgres trigger via `pg_net` (no user session exists in that context) and deployed with `verify_jwt: false`, gated instead by a shared secret header compared against a value provisioned once in Supabase Vault (`pos_order_push_secret` / `push_notify_secret`).

`supabase/config.toml` declares each function's `verify_jwt` value for review purposes, but **the MCP `deploy_edge_function` tool does not read it** — that tool takes `verify_jwt` as a call parameter, so config.toml is a diffable statement of intent (and a real safety net if anyone ever deploys via the CLI instead), not an enforcement mechanism for MCP deploys. `scripts/verify-pos-integration.mjs` is the mechanical guard: it asserts config.toml's values match what each function's own header comment claims.

The POS order-push trigger (`push_order_to_pos()`, `supabase/migrations/0027_pos_order_push_observability.sql`) reads its target Edge Function base URL from `app_secrets.functions_base_url` rather than a hardcoded literal — not a secret, just config, so it lives in the same singleton table as the QR-token signing key (`0008_qr_token_verification.sql`) rather than Vault. The same migration adds a `pending` `order_push_status` so a stuck sync (e.g. `POS_ORDER_PUSH_SECRET` not set on the Edge Function) is visible in `IntegrationsTab.jsx` as "still waiting" rather than indistinguishable from "never configured".

The one non-Edge-Function server-side exception is **`lib/site-content/publish.js`**, a Server Action calling `revalidatePath('/[locale]', 'layout')`. The marketing site is ISR (`revalidate = 900` on `app/[locale]/layout.jsx`), so without it a SuperAdmin CMS edit would take up to 15 minutes to appear. It is acceptable *only* because its body has zero authorization logic and zero data access — the actual write already happened client-side against Supabase under `site_content_super_admin_write`, and RLS remains the entire auth layer. It is not a Route Handler and there is no `app/api/` directory; adding one that needed its own session check would be exactly what this section forbids.

### Four panels, one middleware gate

`middleware.js` is the single point that maps a signed-in user's `profiles.role` to which of the four root surfaces they may reach, redirecting everyone else:

| Route | Component | Role(s) |
|---|---|---|
| `/menu/[restaurant]/[table]` | `CustomerApp.jsx` | unauthenticated (public) |
| `/staff` | `StaffApp.jsx` | `staff`, `restaurant_admin` |
| `/admin` | `AdminApp.jsx` | `restaurant_admin` |
| `/superadmin` | `SuperAdminApp.jsx` + `components/superadmin/*` | `super_admin` |

A `restaurant_admin` additionally can't reach `/admin` until `restaurants.onboarding_completed_at` is set — middleware redirects them to `/onboarding` (the setup wizard) instead, checked server-side, not just client-side. Login is two separate pages by design: `/login` (shared, `restaurant_admin`/`staff`) and `/superadmin-login` (dedicated SuperAdmin entry point — kept as a sibling route rather than nested under `/superadmin` so it doesn't need a carve-out in middleware's matcher). Neither has a sign-up form: **account creation is super-admin-only, end-to-end.** A restaurant and its admin's login are created together in one SuperAdmin form (`create-restaurant-user`); there is no self-service registration path anywhere, and re-adding one requires an explicit product decision, not an incidental change.

Tenant resolution differs by surface: the unauthenticated customer menu reads via the public `get_public_restaurant(slug)` RPC (a narrow, explicit-column-list `SECURITY DEFINER` function — never query `restaurants` directly from that context, it carries billing/PII columns); every authenticated surface reads the full `restaurants` row via `profiles.restaurant_id`.

### Data flow: store → service → Supabase, refetch not patch

Every mutation in `lib/store.js` follows the same shape: call a function from `lib/services/supabaseService.js` (or a sibling service file) → on success, **refetch the whole collection** from Supabase rather than locally patching the array → `set()` the new collection → for anything worth auditing, `get().recordAudit({ action, entityType, entityId, summary })`. Don't optimistically mutate store arrays in place; follow the existing refetch pattern even though it's an extra round trip.

`lib/services/supabaseService.js` is also where the snake_case (DB) ↔ camelCase (JS) translation happens for products/categories, via `normalizeProduct`/`toProductRow`/`toCategoryRow` — the `toXRow` builders are **explicit field whitelists**, not `{...spread}`, because PostgREST 400s on any unknown column key. Any new writable field on `products`/`categories` needs a line added to the relevant builder or it silently never gets sent.

Realtime subscriptions go through `lib/services/realtime.js`'s single `RealtimeManager` (`subscribeOrders`/`subscribeProducts`/etc., all `subscribe(table, handler, { restaurantId })`) — always pass `restaurantId` to get a tenant-filtered Postgres changes stream.

### Three design systems — do not mix them

- **`components/kit/`** ("Quiet Premium", `--k-*` CSS tokens, `.kit-dark`/`.kit-light` scoped to each panel root) is the live system for all four app panels (Customer, Staff, Admin, SuperAdmin) **and** the four auth/setup pages: `/login`, `/superadmin-login`, `/reset-password`, `/onboarding`. All new UI on those surfaces uses `kit` primitives (`Card`, `Button`, `Field`, `Input`, `Switch`, `Tag`, `PageHeader`, `Sheet`, `ConfirmDialog`/`useConfirmDialog`, etc. — see `components/kit/index.js`).
- **`components/mkt/`** ("Süfrə", `--mkt-*` tokens, `.mkt` scoped to `app/[locale]/layout.jsx`'s root div) is the public marketing site only (`app/[locale]/**`, `components/marketing/**`). Warm walnut ground + brass/sage accents + Fraunces display face — deliberately its own visual language, not a restyle of the panels.
- **`.customer-theme`** (`--mf-*` tokens, declared in `app/globals.css`) is the last surviving piece of the retired primitive kit: the per-restaurant-themed customer QR menu (`CustomerApp`/`ProductCard`/`ProductDetailModal`/`CartDrawer`), whose accent comes from `--theme-primary` injected from the DB at runtime. **Do not delete these `--mf-*` declarations** — the `.mf-dark` body class and `components/ui/` that used the same prefix are both gone, but this block is live.

They are deliberately separate trees with non-overlapping token namespaces so a file can't accidentally import from two and end up with competing systems. `scripts/verify-design-systems.mjs` enforces this mechanically: no file may import from both `kit` and `mkt`, no `--k-*` may appear under `components/mkt/`, no `--mkt-*` under `components/kit/`. Run it after any cross-surface UI change.

### Two independent authorization axes — don't conflate them

- **`lib/services/capabilityService.js`** (`CAPABILITIES`, `hasCapability`/`useCapability`) — role-scoped, static: "can a `staff` account do X at all?" No per-restaurant override; this is about job function.
- **`lib/services/entitlementService.js`** (`FEATURES`, `hasFeature`/`useFeature`) — plan-scoped, DB-hydratable: "does *this restaurant's* plan include feature X?" Precedence is restaurant-level override → plan default → registry default. Backed by the `plans`/`plan_features` tables (hydrated into the in-memory registry once via `store.loadPlans()`).

Both resolvers are **UI-layer only** (`enforcement: 'ui'` in the entitlement registry) — they decide what renders, not what the database accepts. Hiding a button stops an honest user from a wrong click, not a motivated one from calling Supabase directly; real enforcement for anything that matters is a separate RLS policy or RPC check. A new premium feature or role-gated action needs both: the resolver entry *and*, if it's actually sensitive, a server-side check to match.

### Security invariants — do not weaken these without deliberate review

- Order/line pricing is **always server-computed** (`place_order()`, `price_order_item()`) — the client-sent total/price is never trusted, only read back after insert.
- QR-code table links carry an HMAC-signed token (`restaurant_tables.qr_token`, column-hidden from normal selects); order placement, waiter/bill alerts, and the customer's own order list (`get_table_orders()`) all re-verify it server-side via `verify_qr_token()`.
- RLS is default-deny; a table with no policies (e.g. `pos_integrations`, which holds a live third-party API token) is reachable *only* through `SECURITY DEFINER` RPCs or a service-role Edge Function client, never through a PostgREST grant.
- `profiles.role`/`restaurant_id` are never writable by the row's own owner (no self-escalation) — only `super_admin` or the specific server-side flows above touch them.

### i18n

Per-surface dictionary files under `lib/i18n/dictionaries/*.js` (one file covers every component/tab that belongs to that surface — e.g. `admin.js` covers all of `AdminApp.jsx`'s tabs including `IntegrationsTab`/`PromotionsTab`/`AuditLogTab`, there is no per-tab file), each exporting a `useXTranslation()` hook built from `lib/i18n/index.js`'s `createTranslationHook(dictionary)` factory. Every dictionary has `az`/`en`/`ru` blocks with identical keys; a value can be a plain string or a function for interpolation (e.g. `(count) => \`${count} items\``). `CustomerApp.jsx`'s own *UI chrome* strings (buttons, labels, static copy) are the one exception, still keyed off the older `lib/translations.js` — that migration to `lib/i18n/dictionaries/` is still unbuilt. *Menu content* (product/category names and descriptions) is a separate, now-solved problem: `products.translations`/`categories.translations` (jsonb, `0029_product_category_translations.sql`) let an admin enter optional EN/RU overrides from `AdminApp.jsx`'s Product/Category modals, and `getLocalizedProduct()`/`getLocalizedCategoryName()` in `lib/translations.js` resolve DB translation → legacy `data/menu.json` seed-id map (offline/no-Supabase mode) → AZ source value. New user-facing UI strings always need entries in all three language blocks; the fallback chain (requested language → `az` → the raw key itself) makes a missing key visibly wrong rather than silently blank, so don't rely on it. `scripts/verify-i18n-keys.mjs` asserts every dictionary's az/en/ru key sets match and that every key is referenced somewhere in the repo — run it after adding or removing any key. It is **green (854 keys, 0 orphaned)** and is a real gate: a newly-orphaned key fails the run immediately. It understands three call shapes — literal `t('key')`, indirect `{titleKey: 'key'}` consumed as `t(item.titleKey)`, and template-literal (`` t(`${currentStep}StepTitle`) `` in `OnboardingWizard.jsx`) — so a live key assembled at runtime is not reported as dead. That third shape was added after the script wrongly flagged 15 live onboarding keys; deleting one on that evidence would have rendered a raw `infoStepTitle` on screen.

**Two sources of language, split by surface.** The marketing site is URL-routed (`/az/...`, `/en/...`, `/ru/...`): under `app/[locale]/**` the URL segment is the *only* source of truth, resolved server-side via `lib/i18n/server.js`'s `getDictionary()` — calling `useLanguage()` there is forbidden, since a Server Component has no client store. Everywhere else (the four panels, `/login`, `/menu`) the client `languageStore` remains the source of truth. The marketing locale switcher writes one-way (URL → store) so a visitor reading `/en/pricing` who clicks "Log in" lands on an English `/login`; nothing ever writes the URL from the store. Both paths share one resolver (`lib/i18n/resolve.js`) so the fallback chain can't drift.

**Marketing page copy is not in the dictionaries.** Hero headlines, CTA labels, contact details and the FAQ live in `site_content`/`site_faq_items` (`0032_site_content_cms.sql`), edited from SuperAdmin's "Veb sayt" mode. `lib/services/siteContentService.js`'s `SITE_CONTENT_GROUPS` is the frozen key registry — adding an editable string means adding it there, to the migration's seed, and to `lib/site-content/defaults.js` (the offline fallback), in that order; `scripts/verify-site-content.mjs` asserts the three stay in sync. `marketing.js` keeps only chrome/nav/labels and structured card content deliberately out of CMS scope.

### Local environment

Without `.env.local` configured (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `lib/supabase.js` exports a no-op fallback client (`supabaseReady === false`) instead of throwing, so the app still renders using `data/menu.json` seed data — check `supabaseReady` before assuming a Supabase call will actually run. `npm run build` uses `--webpack` deliberately (not the default Turbopack) — this was a specific fix for a production build issue, not a leftover default; don't switch it back without checking why.
