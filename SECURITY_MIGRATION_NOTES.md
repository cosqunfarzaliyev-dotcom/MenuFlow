# Security hardening follow-up

The following SQL files should be applied in order in the Supabase SQL Editor for the active project:

1. supabase/migrations/0001_multi_tenant_saas.sql
2. supabase/migrations/0002_security_hardening.sql
3. supabase/migrations/0003_billing_self_service.sql
4. supabase/migrations/0014_slug_server_side_validation.sql
5. supabase/migrations/0015_restaurant_level_rate_limit.sql

Recommended order:
- Apply each migration once, in order.
- If you already ran earlier migrations, only apply the new files listed above.
- After applying them, verify the RPC and trigger behavior in your Supabase project.
