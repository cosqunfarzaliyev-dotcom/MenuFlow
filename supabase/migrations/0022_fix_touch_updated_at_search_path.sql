-- ============================================================================
-- MenuFlow — fix: touch_updated_at() missing search_path
-- ============================================================================
-- 0021_plan_subscription_system.sql's touch_updated_at() was the one
-- function in that migration written without `set search_path = public`,
-- unlike every other function in this schema — caught by the Supabase
-- security advisor immediately after applying 0021
-- (`function_search_path_mutable`). No exploitable impact today (the
-- function references no unqualified table/function names, only NEW), but
-- a mutable search_path is a real category of risk in general (a caller
-- with CREATE privilege on a schema earlier in their search_path could
-- shadow an object the function relies on) and every other function here
-- already sets it — this was just an oversight, not a deliberate exception.
--
-- Run this after 0021_plan_subscription_system.sql.
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
