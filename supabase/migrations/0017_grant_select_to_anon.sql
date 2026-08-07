-- Grant read access to anon role for local development
-- Run this in Supabase SQL editor or via psql against your project database.

GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.discounts TO anon;
GRANT SELECT ON public.orders TO anon;
GRANT SELECT ON public.banners TO anon;
GRANT SELECT ON public.alerts TO anon;

-- If you add more tables, include them here.
