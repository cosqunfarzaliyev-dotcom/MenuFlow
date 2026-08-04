import { redirect } from 'next/navigation';

// Pre-multi-tenant QR codes point to /menu/[table] (e.g. /menu/12). All
// data from before the multi-tenant migration was moved into a restaurant
// with slug "default" (see supabase/migrations/0001_multi_tenant_saas.sql),
// so old codes still work — they just get redirected to the new
// /menu/[restaurant]/[table] path instead of 404ing.
export default async function LegacyTableMenuPage({ params }) {
  const { restaurant } = await params;
  redirect(`/menu/default/${encodeURIComponent(restaurant)}`);
}
