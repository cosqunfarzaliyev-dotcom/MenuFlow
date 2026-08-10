-- ============================================================================
-- MenuFlow — payment_method on orders (not just alerts)
-- ============================================================================
-- alerts.payment_method already tracks how a customer wants to pay when
-- they request the bill (0006_admin_feature_pack.sql). Orders themselves had
-- no equivalent, so there was nowhere to record "customer chose Google
-- Pay/Apple Pay when sending this order to the kitchen" — kitchen/staff had
-- no visibility into it at order time, only later at bill time.
--
-- Same pattern as alerts: plain text column, no check constraint (kept
-- permissive on purpose), just a comment documenting the expected values.
-- ============================================================================

alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_method_label text;

comment on column public.orders.payment_method is
  'cash | card | google_pay | apple_pay';
