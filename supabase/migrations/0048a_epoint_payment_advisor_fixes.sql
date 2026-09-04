-- ============================================================================
-- MenuFlow — 0048's advisor fix: table_id FK on payment_transactions was
-- only covered by the (restaurant_id, table_id) composite index's SECOND
-- column, not its leading one — get_advisors flagged it as an unindexed FK
-- immediately after 0048 applied. Same follow-up pattern as
-- 0026a_pos_integration_advisor_fixes.sql.
-- ============================================================================
create index if not exists payment_transactions_table_id_idx
  on public.payment_transactions (table_id);
