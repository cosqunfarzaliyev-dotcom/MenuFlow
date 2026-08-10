# MenuFlow — Project Map

## Purpose

This file is the fast navigation map for Claude Code.

Use this file before exploring the repository.

Do not scan the entire repository for normal tasks.

First identify the subsystem involved, then inspect only the relevant files.

---

# 1. Application Overview

MenuFlow is a multi-tenant QR restaurant menu and restaurant management platform.

Main application areas:

- Customer Menu
- Staff Panel
- Admin Panel
- Super Admin Panel
- Authentication
- Restaurant Management
- Products
- Categories
- Tables
- QR Codes
- Orders
- Waiter Calls
- Bill Requests
- Notifications
- Languages
- Themes
- Reports
- Analytics
- Payments

---

# 2. Main User Roles

## Super Admin

Platform-level administration.

Typical responsibilities:

- restaurants
- platform users
- platform-level settings
- subscriptions
- platform analytics
- system management

Super Admin is not the same as a restaurant Admin.

---

## Admin

Restaurant-level management.

Typical responsibilities:

- restaurant settings
- products
- categories
- tables
- QR codes
- orders
- staff
- reports
- analytics
- languages
- themes

---

## Staff

Restaurant operational management.

Typical responsibilities:

- incoming orders
- order status
- waiter calls
- bill requests
- notifications
- realtime operational data

---

## Customer

Restaurant customer using the QR menu.

Typical responsibilities:

- browse menu
- categories
- products
- product details
- cart
- order creation
- active orders
- call waiter
- request bill
- language selection
- theme

---

# 3. High-Level Application Flow

## Customer Flow

QR Code
→ Customer Menu
→ Restaurant/Table Context
→ Categories
→ Products
→ Cart
→ Create Order
→ Supabase
→ Realtime
→ Staff/Admin

---

## Staff Flow

Authentication
→ Staff Panel
→ Restaurant Context
→ Orders / Alerts
→ Supabase
→ Realtime
→ Staff UI

---

## Admin Flow

Authentication
→ Admin Panel
→ Restaurant Context
→ Restaurant Management
→ Products / Categories / Tables / QR
→ Orders / Reports / Analytics

---

## Super Admin Flow

Authentication
→ Super Admin Authorization
→ Super Admin Panel
→ Platform Management
→ Restaurants / Users / Platform Data

---

# 4. Multi-Tenant Architecture

MenuFlow is multi-tenant.

The fundamental isolation rule is:

Restaurant A must never access Restaurant B data.

Conceptually:

Restaurant
├── Admin
├── Staff
├── Tables
├── Products
├── Categories
├── Orders
├── Alerts
└── Settings

Every restaurant-owned resource must be correctly associated with its restaurant.

Important security fields may include:

- `restaurant_id`
- user identity
- role
- ownership
- table context

Never assume that a client-provided `restaurant_id` is trustworthy.

---

# 5. Customer Menu

The Customer Menu is the public/customer-facing restaurant menu.

Main responsibilities:

- restaurant branding
- table identification
- language selection
- categories
- products
- product details
- cart
- orders
- waiter calls
- bill requests
- order status
- notifications

Typical flow:

QR
→ menu
→ table context
→ products
→ cart
→ order

---

# 6. QR System

The QR system connects a restaurant table to the Customer Menu.

General flow:

Admin
→ Table
→ QR Generation
→ QR Code
→ Customer Scan
→ QR/Token Parsing
→ Validation
→ Restaurant + Table Context
→ Customer Menu

QR data is untrusted input.

When signed tokens are used, token validation must be preserved.

Important areas:

- QR generation
- QR payload
- token validation
- table resolution
- restaurant resolution
- order context
- alert context
- RLS

For QR-specific architecture, read:

`docs/QR_SYSTEM.md`

---

# 7. Order System

General order flow:

Customer
→ Cart
→ Order Creation
→ `orders`
→ `order_items`
→ Supabase
→ Realtime
→ Staff/Admin

Important relationships:

```text
restaurant
    ↓
order
    ↓
order_items
    ↓
product
```

Where applicable:

```text
restaurant
    ↓
table
    ↓
order
```

Order security must preserve restaurant isolation.

For order-specific architecture, read:

`docs/ORDER_SYSTEM.md`

---

# 8. Staff Order Flow

Staff Panel receives operational restaurant data.

Typical flow:

Customer creates order
→ Supabase order record
→ Realtime event
→ Staff subscription
→ Application state
→ Staff UI

When Staff orders are not updating, inspect in this order:

1. Customer order creation
2. Supabase database event
3. Realtime configuration
4. Staff subscription
5. Subscription filter
6. Restaurant context
7. Zustand/application state
8. Staff UI rendering

Do not inspect unrelated UI first.

---

# 9. Realtime

Realtime is used for operational synchronization.

Known use cases include:

- orders
- order status
- waiter calls
- bill requests
- alerts

General flow:

Database Change
→ Supabase Realtime
→ Authorized Subscription
→ Application State
→ UI

Important:

Frontend filtering is not a security mechanism.

Realtime must not leak data between restaurants.

For realtime-specific architecture, read:

`docs/REALTIME.md`

---

# 10. Authentication

General flow:

User
→ Supabase Auth
→ Profile/User Data
→ Role
→ Restaurant Association
→ Authorization
→ Panel

Roles:

- `super_admin`
- `admin`
- `staff`
- `customer`

When investigating authentication or routing, inspect:

1. Supabase Auth
2. user/profile lookup
3. role resolution
4. restaurant association
5. middleware
6. route protection
7. dashboard/panel selection

For authentication-specific architecture, read:

`docs/AUTH.md`

---

# 11. Database

The backend uses Supabase/PostgreSQL.

Known core entities include:

- restaurants
- profiles
- products
- categories
- tables
- orders
- order_items
- alerts

The actual database schema is authoritative in:

`supabase/migrations/`

Do not assume columns, relationships, policies, functions, or constraints.

Always verify against the actual migrations before making database changes.

For database-specific architecture, read:

`docs/DATABASE.md`

---

# 12. RLS and Security

RLS is a critical part of MenuFlow's multi-tenant security model.

Security-sensitive flows must consider:

- authenticated user
- role
- restaurant
- ownership
- resource relationship
- RLS policy

Important systems:

- restaurants
- profiles
- products
- categories
- tables
- orders
- order_items
- alerts

For security-specific architecture, read:

`docs/SECURITY.md`

---

# 13. Admin Panel

Admin Panel is restaurant-scoped.

Main areas may include:

- dashboard
- products
- categories
- tables
- QR codes
- orders
- staff
- settings
- languages
- themes
- reports
- analytics

When debugging an Admin feature, first identify which subsystem owns the feature.

Do not scan the entire application.

---

# 14. Super Admin Panel

Super Admin is platform-scoped.

Typical areas:

- restaurants
- platform users
- administrators
- subscriptions
- platform analytics
- system configuration

Important:

Do not accidentally apply restaurant-admin authorization rules to Super Admin functionality.

Do not accidentally allow normal restaurant Admin users to access platform-level data.

---

# 15. Payments

Payments are a platform-level integration concern but may ultimately require restaurant-specific account/payment destination handling.

When changing payment functionality, inspect:

1. payment provider integration
2. restaurant/payment account association
3. server-side payment flow
4. webhook handling
5. payment status
6. database records
7. authorization

Never expose private payment credentials to the client.

For payment changes, verify the actual implementation before assuming the architecture.

---

# 16. State Management

The project uses Zustand for client-side application state.

When investigating state-related problems, determine:

1. source of truth
2. store state
3. persistence
4. update action
5. component subscription
6. realtime synchronization if applicable

Do not treat client-side state as a security boundary.

---

# 17. Localization

MenuFlow supports multiple languages.

Known language context includes:

- AZ
- EN
- RU

Language functionality may exist across:

- Customer Menu
- Admin Panel
- Staff Panel
- Super Admin Panel

Do not assume language support is limited to Customer Menu.

When changing localization, preserve existing language architecture and inspect the actual implementation first.

---

# 18. Theme

Theme functionality may be used across the application.

When changing theme behavior:

- preserve existing theme state
- avoid unrelated UI refactors
- check persistence if applicable
- verify all affected panels

---

# 19. Fast Investigation Guide

## Order Bug

Read:

1. `docs/ORDER_SYSTEM.md`
2. relevant Customer order code
3. relevant Staff order code
4. Supabase order queries
5. `orders`
6. `order_items`
7. RLS
8. Realtime

---

## QR Bug

Read:

1. `docs/QR_SYSTEM.md`
2. QR generation
3. QR parsing
4. token validation
5. table resolution
6. restaurant resolution
7. orders/alerts
8. RLS

---

## Authentication Bug

Read:

1. `docs/AUTH.md`
2. Supabase Auth
3. profile/user lookup
4. role resolution
5. restaurant association
6. middleware
7. route protection
8. panel selection

---

## Realtime Bug

Read:

1. `docs/REALTIME.md`
2. database event
3. realtime configuration
4. subscription
5. filters
6. restaurant context
7. Zustand/application state
8. UI

---

## RLS/Security Bug

Read:

1. `docs/SECURITY.md`
2. `docs/DATABASE.md`
3. relevant migration
4. relevant RLS policy
5. table relationships
6. application authorization

---

## Admin Bug

Identify the exact Admin subsystem first.

Then inspect only:

- relevant page/component
- related state
- related database operation
- related authorization/RLS

---

# 20. Repository Exploration Rules

Before searching broadly:

1. Read this file.
2. Identify the subsystem.
3. Search for the relevant function/component/table.
4. Inspect only directly related files.
5. Expand the scope only if necessary.

Prefer:

targeted search
→ relevant file
→ dependency
→ database/RLS if needed

Avoid:

entire repository scan
→ unrelated files
→ unnecessary context

---

# 21. Source of Truth

When information conflicts:

1. Actual database schema/migrations are authoritative for database structure.
2. Actual source code is authoritative for implemented behavior.
3. Documentation describes intended/known architecture.
4. `CLAUDE.md` defines development constraints and safety rules.

If documentation is outdated:

- trust the actual implementation
- fix the documentation after confirming the correct behavior

---

# 22. Documentation Map

Use these documents for focused investigation:

`docs/ARCHITECTURE.md`
→ overall system architecture

`docs/DATABASE.md`
→ database structure and migration guidance

`docs/SECURITY.md`
→ security, RLS, tenant isolation

`docs/AUTH.md`
→ authentication and roles

`docs/QR_SYSTEM.md`
→ QR and token flow

`docs/ORDER_SYSTEM.md`
→ order lifecycle

`docs/REALTIME.md`
→ realtime architecture

`docs/CHANGELOG.md`
→ important architectural changes

---

# 23. Core Principle

Do not learn the entire MenuFlow repository for every task.

Learn only the part required to solve the current problem.

Use this map as the entry point.

Targeted context is preferred over broad context.
